import * as fs from 'fs';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { OpenAIEmbeddings } from '@langchain/openai';
import 'dotenv/config';

async function loadAndStorePDF(filename: string) {
  const filePath = `vectorstore/${filename}`;
  const collectionName = filename.replace('.pdf', '');

  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    return;
  }

  console.log(`📄 Loading: ${filePath} into collection: "${collectionName}"`);

  // ✅ Delete existing collection first
  const client = new QdrantClient({
    url: process.env.QDRANT_URL!,
    apiKey: process.env.QDRANT_API_KEY!,
  });

  try {
    await client.deleteCollection(collectionName);
    console.log(`🗑️ Deleted existing collection: "${collectionName}"`);
  } catch (error: any) {
    if (!error.message?.includes('Not found')) {
      console.log(`ℹ️ Collection "${collectionName}" doesn't exist yet`);
    }
  }

  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdf(dataBuffer);
  const rawText = pdfData.text;

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });

  const docs = await splitter.createDocuments([rawText]);

  console.log(`✂️ Split into ${docs.length} chunks`);
  console.log("🧩 Sample chunk:", docs[0]?.pageContent.slice(0, 200));

  const embeddings = new OpenAIEmbeddings({
    modelName: "text-embedding-3-small",
    openAIApiKey: process.env.OPENAI_API_KEY!,
  });

  await QdrantVectorStore.fromDocuments(docs, embeddings, {
    client,
    collectionName,
  });

  console.log(`✅ Stored "${filename}" as collection: "${collectionName}"`);
}

const fileArg = process.argv[2];
if (!fileArg) {
  console.error('❌ Usage: pnpm tsx scripts/load.ts yourfile.pdf');
  process.exit(1);
}

loadAndStorePDF(fileArg).catch(console.error);
