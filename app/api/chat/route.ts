// app/api/chat/route.ts

import { ChatTogetherAI } from "@langchain/community/chat_models/togetherai";
import { TogetherAIEmbeddings } from "@langchain/community/embeddings/togetherai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";

const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

const embeddings = new TogetherAIEmbeddings({
  modelName: "BAAI/bge-large-en-v1.5",
  apiKey: process.env.TOGETHER_API_KEY!,
});

const model = new ChatTogetherAI({
  modelName: "mistralai/Mistral-7B-Instruct-v0.2", // or any other you choose
  apiKey: process.env.TOGETHER_API_KEY!,
  temperature: 0.4,
  maxTokens: 1024,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, selectedDoc } = body;

    const historyMessages = messages.slice(0, -1);
    const currentMessage = messages[messages.length - 1];

    const chatHistory = historyMessages.map((msg: any) =>
      msg.role === "user"
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    );

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        collectionName: selectedDoc,
        client: qdrantClient,
      }
    );

    const retriever = vectorStore.asRetriever({ k: 4 });

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant. Use the provided context to answer the following question as accurately as possible.
If the answer is not supported by the context, say: "I don't know." Do not answer from general knowledge.`,
      ],
      new MessagesPlaceholder("chat_history"),
      ["human", "Context:\n{context}\n\nQuestion:\n{question}"],
    ]);

    const chain = RunnableSequence.from([
      {
        context: async (input) => {
          const docs = await retriever.getRelevantDocuments(input.question);
          return docs.map((doc) => doc.pageContent).join("\n\n");
        },
        question: (input) => input.question,
        chat_history: (input) => input.chat_history,
      },
      prompt,
      model,
      new StringOutputParser(),
    ]);

    const stream = await chain.stream({
      question: currentMessage.content,
      chat_history: chatHistory,
    });

    const textStream = new TextEncoderStream();
    const writer = textStream.writable.getWriter();

    (async () => {
      for await (const chunk of stream) {
        await writer.write(chunk);
      }
      await writer.close();
    })();

    return new Response(textStream.readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  } catch (error) {
    console.error("❌ RAG Error:", error);
    return new Response(JSON.stringify({ error: "Something went wrong" }), {
      status: 500,
    });
  }
}
