// İstemci, sunucu API'sinin varlığını bununla anlar (statik barındırmada 404 döner)
import { json, type Ctx } from '../_lib';

export const onRequestGet = (ctx: Ctx) =>
  json({ ok: true, google: !!ctx.env.GOOGLE_CLIENT_ID, ai: !!ctx.env.AI || ctx.env.AI_FAKE === '1', db: !!ctx.env.DB, files: !!ctx.env.FILES });
