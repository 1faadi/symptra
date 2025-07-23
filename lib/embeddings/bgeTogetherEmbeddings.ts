import { Embeddings } from '@langchain/core/embeddings';
import Together from 'together-ai';

export class TogetherBGEEmbeddings extends Embeddings {
  model: string;
  client: any;
  cache: Map<string, number[]>;

  constructor({ model, apiKey }: { model: string; apiKey: string }) {
    super({});
    this.model = model;
    this.client = new Together({ apiKey });
    this.cache = new Map();
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts, // ✅ Batch input
    });

    return response.data.map((res: any) => res.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    if (this.cache.has(text)) return this.cache.get(text)!;

    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });

    const embedding = response.data[0].embedding;
    this.cache.set(text, embedding);
    return embedding;
  }
}
