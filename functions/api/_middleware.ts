// Tüm /api/* istekleri: köken denetimi + beklenmeyen hataları JSON'a çevir
import { err, sameOrigin, type Ctx } from '../_lib';

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const m = ctx.request.method;
  if (m !== 'GET' && m !== 'HEAD' && !sameOrigin(ctx.request)) return err('Geçersiz köken.', 403);
  try {
    return await ctx.next();
  } catch (e) {
    // Ayrıntı yalnızca Worker günlüğüne yazılır; istemciye iç hata metni (SQL, yığın izi) gönderilmez
    console.error(e);
    return err('Sunucuda beklenmeyen bir hata oluştu. Lütfen tekrar dene.', 500);
  }
};
