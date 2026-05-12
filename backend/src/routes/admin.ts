import express from "express";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { v2 as cloudinary } from "cloudinary";
import prisma from "../lib/prisma";

const router = express.Router();

/* =========================
   CLOUDINARY CONFIG
========================= */

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* =========================
   MULTER CLOUDINARY
========================= */

const storage = new CloudinaryStorage({
  cloudinary,
  params: async () => ({
    folder: "movies",
    allowed_formats: ["jpg", "jpeg", "png", "webp"],
  }),
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

/* =========================
   GET MOVIES
========================= */

router.get("/movies", async (_req, res) => {
  try {
    const movies = await prisma.movie.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json(movies);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: "Erro ao buscar filmes",
    });
  }
});

/* =========================
   CREATE MOVIE
========================= */

router.post(
  "/movies",
  upload.single("poster"),
  async (req, res) => {
    try {
      const {
        title,
        description,
        category,
        year,
        videoUrl,
      } = req.body;

      const poster = req.file
        ? (req.file as any).path
        : null;

      const movie = await prisma.movie.create({
        data: {
          title,
          description,
          category,
          year: Number(year),
          videoUrl,
          poster,
        },
      });

      res.status(201).json(movie);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Erro ao criar filme",
      });
    }
  }
);

/* =========================
   UPDATE MOVIE
========================= */

router.put(
  "/movies/:id",
  upload.single("poster"),
  async (req, res) => {
    try {
      const { id } = req.params;

      const movieExists = await prisma.movie.findUnique({
        where: {
          id,
        },
      });

      if (!movieExists) {
        return res.status(404).json({
          error: "Filme não encontrado",
        });
      }

      const updateData: any = {
        title: req.body.title,
        description: req.body.description,
        category: req.body.category,
        year: Number(req.body.year),
        videoUrl: req.body.videoUrl,
      };

      if (req.file) {
        updateData.poster = (req.file as any).path;
      }

      const movie = await prisma.movie.update({
        where: {
          id,
        },
        data: updateData,
      });

      res.json(movie);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "Erro ao atualizar filme",
      });
    }
  }
);

/* =========================
   DELETE MOVIE
========================= */

router.delete("/movies/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const movie = await prisma.movie.findUnique({
      where: {
        id,
      },
    });

    if (!movie) {
      return res.status(404).json({
        error: "Filme não encontrado",
      });
    }

    /* REMOVE IMAGEM DO CLOUDINARY */

    if (movie.poster) {
      try {
        const parts = movie.poster.split("/");
        const fileName = parts[parts.length - 1];
        const publicId =
          "movies/" + fileName.split(".")[0];

        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.error("Erro ao deletar imagem:", err);
      }
    }

    await prisma.movie.delete({
      where: {
        id,
      },
    });

    res.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Erro ao deletar filme",
    });
  }
});

export default router;