import { ChatTogetherAI } from '@langchain/community/chat_models/togetherai';
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { TogetherAIEmbeddings } from '@langchain/community/embeddings/togetherai';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { QdrantClient } from '@qdrant/js-client-rest';
import { NextResponse } from 'next/server';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, selectedDoc } = body;

    const historyMessages = messages.slice(0, -1);
    const currentMessage = messages[messages.length - 1];

    const chatHistory = historyMessages.map((msg: any) =>
      msg.role === 'user'
        ? new HumanMessage(msg.content)
        : new AIMessage(msg.content)
    );

    const client = new QdrantClient({
      url: process.env.QDRANT_URL!,
      apiKey: process.env.QDRANT_API_KEY!,
    });

    const embeddings = new TogetherAIEmbeddings({
      modelName: 'togethercomputer/m2-bert-80M-32k-retrieval',
      apiKey: process.env.TOGETHER_API_KEY!,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      collectionName: selectedDoc,
      client,
    });

    const retriever = vectorStore.asRetriever({ k: 4 });

    const model = new ChatTogetherAI({
      modelName: 'togethercomputer/llama-3-8b-chat',
      apiKey: process.env.TOGETHER_API_KEY!,
      temperature: 0.4,
      maxTokens: 1024,
    });

    // ✅ Create custom prompt with instruction to answer only based on context
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant. Only answer based on the context provided. 
If the answer is not explicitly present in the context, respond with:
"I don't know."`,
      ],
      new MessagesPlaceholder("chat_history"),
      ["human", "Context:\n{context}\n\nQuestion:\n{question}"],
    ]);

    // ✅ Compose custom chain using LCEL
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

    const responseText = await chain.invoke({
      question: currentMessage.content,
      chat_history: chatHistory,
    });

    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(new TextEncoder().encode(responseText));
        controller.close();
      },
    });

    return new NextResponse(stream);
  } catch (err) {
    console.error("❌ Chat error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
