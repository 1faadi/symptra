import * as fs from 'fs';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TogetherAIEmbeddings } from '@langchain/community/embeddings/togetherai';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import 'dotenv/config';

async function loadAndStorePDF(filename: string) {
  const filePath = `vectorstore/${filename}`;
  const collectionName = filename.replace('.pdf', '');

  if (!fs.existsSync(filePath)) {
    console.error(`\u274C File not found: ${filePath}`);
    return;
  }

  console.log(`\ud83d\udcc4 Loading: ${filePath} into collection: "${collectionName}"`);

  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const rawText = pdfData.text;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const docs = await splitter.createDocuments([rawText]);

  console.log(`\u2702\ufe0f Split into ${docs.length} chunks`);
  console.log("\ud83e\uddf9 Sample chunk:", docs[0]?.pageContent.slice(0, 200));

  const embeddings = new TogetherAIEmbeddings({
    apiKey: process.env.TOGETHER_API_KEY!,
    modelName: 'BAAI/bge-large-en-v1.5',
  });

  const client = new QdrantClient({
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY!,
  });

  await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName,
  });

  console.log(`\u2705 Stored "${filename}" as collection: "${collectionName}"`);
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('\u274C Usage: pnpm tsx scripts/load.ts yourfile.pdf');
  process.exit(1);
}

loadAndStorePDF(fileArg).catch(console.error);