import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Numele trebuie sa aiba minim 2 caractere.').max(80),
  email: z.string().trim().toLowerCase().email('Adresa de email nu este valida.'),
  password: z.string().min(8, 'Parola trebuie sa aiba minim 8 caractere.').max(200),
  role: z.enum(['TEACHER', 'STUDENT', 'PARENT']),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Adresa de email nu este valida.'),
  password: z.string().min(1, 'Introdu parola.'),
});

export const createClassSchema = z.object({
  name: z.string().trim().min(2, 'Numele clasei e prea scurt.').max(120),
});

export const joinClassSchema = z.object({
  code: z.string().trim().toUpperCase().length(6, 'Codul are exact 6 caractere.'),
});

export const createTopicSchema = z.object({
  classId: z.string().min(1),
  title: z.string().trim().min(1, 'Titlul e obligatoriu.').max(120),
  background: z.enum(['WHITE', 'MATH', 'DICTANDO', 'MUSIC']).default('WHITE'),
});

export const createLessonSchema = z.object({
  topicId: z.string().min(1),
  title: z.string().trim().min(1, 'Titlul e obligatoriu.').max(160),
  type: z.enum(['THEORY', 'HOMEWORK']).default('THEORY'),
  dueAt: z.string().datetime().optional().nullable(),
});

export const updateLessonSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  published: z.boolean().optional(),
  dueAt: z.string().datetime().nullable().optional(),
});

/** Continutul desenului. Limitam marimea ca sa nu ne umple cineva baza. */
export const contentSchema = z.object({
  content: z.string().max(4_000_000, 'Desenul este prea mare.'),
});

export const gradeSchema = z.object({
  grade: z.string().trim().max(20).optional().nullable(),
  comment: z.string().trim().max(2000).optional().nullable(),
  feedback: z.string().max(4_000_000).optional(),
});

export const linkChildSchema = z.object({
  code: z.string().trim().toUpperCase().length(8, 'Codul copilului are 8 caractere.'),
});

export const notebookSchema = z.object({
  title: z.string().trim().min(1).max(120),
  background: z.enum(['WHITE', 'MATH', 'DICTANDO', 'MUSIC']).default('WHITE'),
});
