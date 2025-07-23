import { TogetherAIEmbeddings } from '@langchain/community/embeddings/togetherai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import 'dotenv/config';

async function queryQdrant(query: string) {
  const embeddings = new TogetherAIEmbeddings({
    apiKey: process.env.TOGETHER_API_KEY!,
    modelName: 'togethercomputer/m2-bert-80M-32k-retrieval',
  });

  const client = new QdrantClient({
    url: 'https://867a961f-77ba-4b05-a68c-160f145cc115.eu-central-1-0.aws.cloud.qdrant.io:6333',
    apiKey: process.env.QDRANT_API_KEY!,
  });

  const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
    client,
    collectionName: 'medical-guidelines',
  });

  const results = await vectorStore.similaritySearch(query, 3); // top 3 results
  console.log('\n🔍 Top matching chunks:\n');

  results.forEach((doc, i) => {
    console.log(`--- Result #${i + 1} ---\n${doc.pageContent}\n`);
  });
}

const userQuestion = process.argv[2];
if (!userQuestion) {
  console.error('❌ Please pass a question as a command-line argument.');
  process.exit(1);
}

queryQdrant(userQuestion).catch(console.error);
