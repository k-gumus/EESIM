// Tek dosyalık (çift tıkla açılan) sürümde WebLLM paketi gömülmez; bu sahte modül kullanılır.
export async function CreateMLCEngine(): Promise<never> {
  throw new Error('Tek dosyalık sürümde WebLLM yok. Tarayıcı içi modeli kullanmak için projeyi `npm run dev` ile çalıştır ya da Ollama’yı seç.');
}
