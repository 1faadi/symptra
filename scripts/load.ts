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
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  console.log(`📄 Loading file: ${filePath} into collection: ${collectionName}`);

  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const rawText = pdfData.text;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await splitter.createDocuments([rawText]);

  const embeddings = new TogetherAIEmbeddings({
    apiKey: process.env.TOGETHER_API_KEY!,
    modelName: 'togethercomputer/m2-bert-80M-32k-retrieval',
  });

  const client = new QdrantClient({
    url: process.env.QDRANT_URL!, // ✅ From .env
    apiKey: process.env.QDRANT_API_KEY!,
  });

  await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName,
  });

  console.log(`✅ Successfully stored ${filename} as collection: ${collectionName}`);
}

// CLI Entry Point
const fileArg = process.argv[2];
if (!fileArg) {
  console.error('❌ Please provide a PDF file name.\nUsage: pnpm tsx scripts/load.ts dengue.pdf');
  process.exit(1);
}

loadAndStorePDF(fileArg).catch(console.error);
