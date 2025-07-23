import * as fs from 'fs/promises';
import * as path from 'path';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { TogetherAIEmbeddings } from '@langchain/community/embeddings/togetherai';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { QdrantClient } from '@qdrant/js-client-rest';
import { Document } from '@langchain/core/documents';

// Configuration interface for better type safety
interface RAGConfig {
  chunkSize?: number;
  chunkOverlap?: number;
  embeddingModel?: string;
  collectionName?: string;
  qdrantUrl?: string;
}

// Default configuration
const DEFAULT_CONFIG: Required<RAGConfig> = {
  chunkSize: 1000,
  chunkOverlap: 200,
  embeddingModel: 'togethercomputer/m2-bert-80M-32k-retrieval',
  collectionName: 'medical-guidelines',
  qdrantUrl: process.env.QDRANT_URL || 'https://867a961f-77ba-4b05-a68c-160f145cc115.eu-central-1-0.aws.cloud.qdrant.io:6333'
};

/**
 * Enhanced RAG service class with better error handling and configuration
 */
export class RAGService {
  private config: Required<RAGConfig>;
  private embeddings: TogetherAIEmbeddings;
  private qdrantClient: QdrantClient;

  constructor(config: RAGConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Validate environment variables
    this.validateEnvironment();
    
    this.embeddings = new TogetherAIEmbeddings({
      apiKey: process.env.TOGETHER_API_KEY!,
      modelName: this.config.embeddingModel,
    });

    this.qdrantClient = new QdrantClient({
      url: this.config.qdrantUrl,
      apiKey: process.env.QDRANT_API_KEY!,
    });
  }

  private validateEnvironment(): void {
    const requiredEnvVars = ['TOGETHER_API_KEY', 'QDRANT_API_KEY'];
    const missing = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }

  /**
   * Load and parse PDF file
   */
  private async loadPDF(filePath: string): Promise<string> {
    try {
      if (!await this.fileExists(filePath)) {
        throw new Error(`PDF file not found: ${filePath}`);
      }

      const dataBuffer = await fs.readFile(filePath);
      const pdfData = await pdf(dataBuffer);
      
      if (!pdfData.text || pdfData.text.trim().length === 0) {
        throw new Error('PDF file appears to be empty or contains no readable text');
      }

      return pdfData.text;
    } catch (error) {
      console.error(`Error loading PDF from ${filePath}:`, error);
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Split text into chunks
   */
  private async splitText(text: string): Promise<Document[]> {
    try {
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: this.config.chunkSize,
        chunkOverlap: this.config.chunkOverlap,
      });

      const docs = await splitter.createDocuments([text]);
      
      if (docs.length === 0) {
        throw new Error('No documents were created from the text');
      }

      console.log(`✅ Split text into ${docs.length} chunks`);
      return docs;
    } catch (error) {
      console.error('Error splitting text:', error);
      throw new Error(`Failed to split text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Store documents in vector database
   */
  private async storeDocuments(docs: Document[]): Promise<QdrantVectorStore> {
    try {
      console.log(`📦 Storing ${docs.length} documents in Qdrant...`);
      
      const vectorStore = await QdrantVectorStore.fromDocuments(
        docs, 
        this.embeddings, 
        {
          client: this.qdrantClient,
          collectionName: this.config.collectionName,
        }
      );

      console.log('✅ Documents stored in Qdrant vector database!');
      return vectorStore;
    } catch (error) {
      console.error('Error storing documents:', error);
      throw new Error(`Failed to store documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load and store PDF with comprehensive error handling
   */
  async loadAndStorePDF(filePath: string = 'vectorstore/dengue.pdf'): Promise<QdrantVectorStore> {
    try {
      console.log(`📚 Loading PDF from: ${filePath}`);
      
      // Resolve absolute path
      const absolutePath = path.resolve(filePath);
      
      // Load and parse PDF
      const rawText = await this.loadPDF(absolutePath);
      console.log(`📄 Extracted ${rawText.length} characters from PDF`);

      // Split into chunks
      const docs = await this.splitText(rawText);

      // Store in vector database
      const vectorStore = await this.storeDocuments(docs);

      return vectorStore;
    } catch (error) {
      console.error('❌ Failed to load and store PDF:', error);
      throw error;
    }
  }

  /**
   * Load existing vector store (for querying)
   */
  async getVectorStore(): Promise<QdrantVectorStore> {
    try {
      const vectorStore = await QdrantVectorStore.fromExistingCollection(
        this.embeddings,
        {
          client: this.qdrantClient,
          collectionName: this.config.collectionName,
        }
      );

      return vectorStore;
    } catch (error) {
      console.error('Error loading existing vector store:', error);
      throw new Error(`Failed to load vector store: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Perform similarity search
   */
  async similaritySearch(query: string, k: number = 5): Promise<Document[]> {
    try {
      const vectorStore = await this.getVectorStore();
      const results = await vectorStore.similaritySearch(query, k);
      
      console.log(`🔍 Found ${results.length} relevant documents for query: "${query.substring(0, 50)}..."`);
      return results;
    } catch (error) {
      console.error('Error performing similarity search:', error);
      throw new Error(`Failed to perform similarity search: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if collection exists
   */
  async collectionExists(): Promise<boolean> {
    try {
      const collections = await this.qdrantClient.getCollections();
      return collections.collections.some(col => col.name === this.config.collectionName);
    } catch (error) {
      console.error('Error checking collection existence:', error);
      return false;
    }
  }
}

// Convenience function for backward compatibility
export async function loadAndStorePDF(filePath?: string): Promise<void> {
  const ragService = new RAGService();
  await ragService.loadAndStorePDF(filePath);
}