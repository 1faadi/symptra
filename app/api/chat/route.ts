import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
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

const embeddings = new OpenAIEmbeddings({
  modelName: "text-embedding-3-small",
  openAIApiKey: process.env.OPENAI_API_KEY!,
});

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  openAIApiKey: process.env.OPENAI_API_KEY!,
  temperature: 0.4,
  maxTokens: 1024,
  streaming: true, // ✅ Enable streaming
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, selectedDoc } = body;

    // ✅ Better validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid input: messages array is required.", { status: 400 });
    }

    const currentMessage = messages[messages.length - 1];
    
    if (!currentMessage?.content || typeof currentMessage.content !== "string") {
      return new Response("Invalid input: missing user message.", { status: 400 });
    }

    // ✅ Improved chat history handling - take all previous messages
    const chatHistory = messages.slice(0, -1).map((msg: any) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);
      } else {
        // Handle any other message types gracefully
        return new AIMessage(msg.content);
      }
    });

    console.log(`📊 Chat history length: ${chatHistory.length} messages`);
    console.log(`📊 Current question: ${currentMessage.content.slice(0, 100)}...`);

    // ✅ Use hardcoded collection name until the parameter issue is fixed
    const collectionName = 'company-policy'; // or selectedDoc if you've fixed the parameter issue

    const vectorStore = await QdrantVectorStore.fromExistingCollection(
      embeddings,
      {
        collectionName,
        client: qdrantClient,
      }
    );

    const retriever = vectorStore.asRetriever({ 
      k: 4,
      searchType: "similarity",
    });

    // ✅ Enhanced prompt with better context awareness
    const prompt = ChatPromptTemplate.fromMessages([
      [
       "system",
`You are BXTrack Solutions' official company policy assistant, specialized in helping employees understand and navigate company policies, procedures, and workplace guidelines.

**COMPANY CONTEXT:**
- BXTrack Solutions operates on a 5-day work week (Monday-Friday) with weekends off
- Salary calculations are based on working days only
- Office hours: 9:00 AM to 6:00 PM with a break from 1:20 PM to 2:20 PM
- Current policy version: 2.0 (Effective January 01, 2025)

**RESPONSE FORMATTING RULES:**
- Use clear, plain text formatting without markdown symbols
- Use bullet points (•) for policy lists
- Use UPPERCASE for emphasis instead of bold formatting
- Structure calculations in a clear, organized manner
- Use proper indentation and spacing for readability

**SALARY CALCULATION FORMAT:**
When calculating salaries, use this exact format:

SALARY CALCULATION:
   - Monthly Salary: 50,000
   - Daily Salary: 50,000 ÷ 21 working days = 2,380.95

LEAVE DEDUCTIONS:
   - Number of leaves taken: 3
   - Extra leaves requiring deduction: 1
   - Deduction amount: 2,380.95 (one day's salary)

LATE ARRIVAL DEDUCTION:
   - Late arrival time: 9:47 AM
   - Deduction rate: 30% of one day's salary
   - Deduction amount: 30% of 2,380.95 = 714.29

   TOTAL DEDUCTIONS:
   - Extra leave deduction: 2,380.95
   - Late arrival deduction: 714.29
   - TOTAL DEDUCTIONS: 3,095.24

FINAL SALARY:
   - Salary after deductions: 50,000 - 3,095.24 = 46,904.76

**KEY POLICY AREAS I CAN HELP WITH:**
- Employment contracts, probation periods, and termination procedures
- Attendance policies, late arrival deductions, and overtime rules
- Leave policies (vacation days, short leaves, sandwich leave policy)
- Workplace conduct, harassment prevention, and professional communication
- Confidentiality, data protection, and laptop usage policies
- Compensation, bonus structures, and salary deductions
- Dress code standards and conflict of interest guidelines

**RESPONSE GUIDELINES:**
- Provide accurate information based strictly on the company policy context
- Reference specific policy sections (e.g., "According to Section 4.1 - Paid Vacation Days...")
- For salary/deduction calculations, use clear numerical formatting and show all steps
- Maintain conversation continuity by acknowledging previous questions when relevant
- Use a professional yet friendly tone appropriate for workplace communication
- If information isn't in the policies, clearly state: "I don't have that specific information in the current company policies. Please contact HR at hr@bxtrack.com for clarification."
- Never use markdown formatting symbols like ** for bold or * for emphasis
- Use clear spacing and indentation to organize information

CONTEXT:
{context}`
,
      ],
      new MessagesPlaceholder("chat_history"),
      ["human", "{question}"],
    ]);

    const chain = RunnableSequence.from([
      {
        context: async (input) => {
          try {
            const docs = await retriever.getRelevantDocuments(input.question);
            const context = docs.length
              ? docs.map((doc) => doc.pageContent).join("\n\n")
              : "No relevant policy documents found.";
            console.log(`📊 Retrieved ${docs.length} relevant documents`);
            return context;
          } catch (error) {
            console.error("❌ Retrieval error:", error);
            return "Error retrieving policy information.";
          }
        },          
        question: (input) => input.question,
        chat_history: (input) => input.chat_history,
      },
      prompt,
      model,
      new StringOutputParser(),
    ]);

    // ✅ Stream the response
    const stream = await chain.stream({
      question: currentMessage.content,
      chat_history: chatHistory,
    });

    // ✅ Create a proper streaming response
    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const data = encoder.encode(chunk);
            controller.enqueue(data);
          }
          controller.close();
        } catch (error) {
          console.error("❌ Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error("❌ RAG Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error occurred" 
      }), 
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
