import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth";
import { writeLog } from "../lib/logger";

const router = Router();

const ALLOWED_EMOJIS = ["🔥", "❤️", "😂", "😮", "👏", "💀","💕","🙏","👀","🤓","😠","💩","🥱","💯","👌","👍"];

// GET /api/reactions/emotes — lista emotes customizados ativos
router.get("/emotes", async (_req: Request, res: Response) => {
  const emotes = await prisma.customEmote.findMany({
    where:   { active: true },
    orderBy: { createdAt: "asc" },
    select:  { id: true, name: true, imageUrl: true },
  });
  res.json(emotes);
});

// GET /api/reactions — busca contagens de TODOS os filmes de uma vez
router.get("/", async (req: Request, res: Response) => {
  const setting = await prisma.setting.findUnique({ where: { key: "reactions_enabled" } });
  if (!setting || setting.value !== "true") {
    return res.json({ enabled: false, data: {} });
  }

  // Busca todas as reações ordenadas por createdAt pra preservar ordem de inserção
  const all = await prisma.reaction.findMany({
    orderBy: { createdAt: "asc" },
    select:  { movieId: true, emoji: true, userId: true },
  });

  // Monta counts mantendo ordem de primeira aparição do emoji por filme
  const counts: Record<string, Record<string, number>> = {};
  const emojiOrder: Record<string, string[]> = {}; // movieId -> emojis em ordem de inserção

  for (const r of all) {
    if (!counts[r.movieId]) { counts[r.movieId] = {}; emojiOrder[r.movieId] = []; }
    if (!counts[r.movieId][r.emoji]) {
      counts[r.movieId][r.emoji] = 0;
      emojiOrder[r.movieId].push(r.emoji);
    }
    counts[r.movieId][r.emoji]++;
  }

  let userReactions: Record<string, string[]> = {};
  if (req.session.userId) {
    const mine = await prisma.reaction.findMany({
      where:   { userId: req.session.userId },
      orderBy: { createdAt: "asc" },
      select:  { movieId: true, emoji: true },
    });
    for (const r of mine) {
      if (!userReactions[r.movieId]) userReactions[r.movieId] = [];
      userReactions[r.movieId].push(r.emoji);
    }
  }

  res.json({ enabled: true, counts, userReactions, emojiOrder });
});

// GET /api/reactions/:movieId — busca contagens e reações do usuário
router.get("/:movieId", async (req: Request, res: Response) => {
  const { movieId } = req.params;

  // Verifica se reações estão ativas
  const setting = await prisma.setting.findUnique({ where: { key: "reactions_enabled" } });
  if (!setting || setting.value !== "true") {
    return res.json({ enabled: false, counts: {}, userReactions: [] });
  }

  // Agrupa contagem por emoji
  const all = await prisma.reaction.findMany({
    where:   { movieId },
    orderBy: { createdAt: "asc" },
    select:  { emoji: true, userId: true },
  });

  const counts: Record<string, number> = {};
  const emojiOrder: string[] = [];
  for (const r of all) {
    if (!counts[r.emoji]) { counts[r.emoji] = 0; emojiOrder.push(r.emoji); }
    counts[r.emoji]++;
  }
  // Remove duplicatas mantendo primeira ocorrência
  const orderedUnique = emojiOrder.filter((e, i) => emojiOrder.indexOf(e) === i);

  let userReactions: string[] = [];
  if (req.session.userId) {
    const mine = await prisma.reaction.findMany({
      where:   { movieId, userId: req.session.userId },
      orderBy: { createdAt: "asc" },
      select:  { emoji: true },
    });
    userReactions = mine.map((r) => r.emoji);
  }

  res.json({ enabled: true, counts, userReactions, emojiOrder: orderedUnique });
});

// POST /api/reactions/:movieId — adiciona ou remove reação (toggle)
router.post("/:movieId", requireAuth, async (req: Request, res: Response) => {
  const { movieId } = req.params;
  const { emoji } = req.body as { emoji: string };
  const userId = req.session.userId!;

  // Valida emoji — aceita padrões ou emotes customizados ativos
  if (!ALLOWED_EMOJIS.includes(emoji)) {
    const customEmote = await prisma.customEmote.findFirst({
      where: { name: emoji, active: true },
    });
    if (!customEmote) {
      return res.status(400).json({ error: "Emoji inválido" });
    }
  }

  // Verifica se reações estão ativas
  const setting = await prisma.setting.findUnique({ where: { key: "reactions_enabled" } });
  if (!setting || setting.value !== "true") {
    return res.status(403).json({ error: "Reações desativadas" });
  }

  const existing = await prisma.reaction.findUnique({
    where: { userId_movieId_emoji: { userId, movieId, emoji } },
  });

  if (existing) {
    // Toggle off — remove
    await prisma.reaction.delete({ where: { id: existing.id } });
  } else {
    // Toggle on — adiciona
    await prisma.reaction.create({ data: { userId, movieId, emoji } });
  }

  // Retorna contagem atualizada com ordem preservada
  const allReactions = await prisma.reaction.findMany({
    where:   { movieId },
    orderBy: { createdAt: "asc" },
    select:  { emoji: true },
  });

  const counts: Record<string, number> = {};
  const emojiOrder: string[] = [];
  for (const r of allReactions) {
    if (!counts[r.emoji]) { counts[r.emoji] = 0; emojiOrder.push(r.emoji); }
    counts[r.emoji]++;
  }
  const orderedUnique = emojiOrder.filter((e, i) => emojiOrder.indexOf(e) === i);

  const mine = await prisma.reaction.findMany({
    where:   { movieId, userId },
    orderBy: { createdAt: "asc" },
    select:  { emoji: true },
  });

  // ── Log ──
  await writeLog({
    action:  "REACTION",
    userId,
    movieId,
    meta: { emoji, removed: !!existing },
  });

  res.json({ counts, userReactions: mine.map((r) => r.emoji), emojiOrder: orderedUnique });
});

export default router;
