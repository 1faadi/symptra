import { Embeddings } from '@langchain/core/embeddings';
import Together from 'together-ai';

export class TogetherBGEEmbeddings extends Embeddings {
  model: string;
  client: any;

  constructor({ model, apiKey }: { model: string; apiKey: string }) {
    super({}); // ✅ Provide an empty config object
    this.model = model;
    this.client = new Together({ apiKey });
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    const results = await Promise.all(
      texts.map(async (text) => {
        const response = await this.client.embeddings.create({
          model: this.model,
          input: text,
        });
        return response.data[0].embedding;
      })
    );
    return results;
  }

  async embedQuery(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }
}
