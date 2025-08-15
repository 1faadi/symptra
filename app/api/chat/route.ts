import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/community/vectorstores/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import teamData from './team-data.json'; // ✅ Import your team data

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
  streaming: true,
});

// ✅ Team data formatting functions
const getTeamInfo = () => {
  let info = "\n**BXTRACK SOLUTIONS TEAM DIRECTORY:**\n\n";
  
  // Executives
  info += "EXECUTIVE TEAM:\n";
  teamData.team.executives.forEach((exec) => {
    const email = exec.email !== "N/A" ? exec.email : "Contact through HR";
    const phone = exec.phone !== "N/A" ? exec.phone : "Contact through HR";
    info += `- ${exec.designation}: ${exec.name}\n`;
    info += `  Email: ${email} | Phone: ${phone}\n`;
    info += `  Joined: ${exec.joiningDate !== "N/A" ? exec.joiningDate : "N/A"}\n\n`;
  });
  
  // HR Department
  info += "HR DEPARTMENT:\n";
  teamData.team.hr.forEach((hr) => {
    info += `- ${hr.designation}: ${hr.name}\n`;
    info += `  Email: ${hr.email} | Phone: ${hr.phone}\n`;
    info += `  Joined: ${hr.joiningDate}\n\n`;
  });
  
  // Engineering Team
  info += "ENGINEERING DEPARTMENT:\n";
  const { teamLead, developers } = teamData.team.engineering;
  
  // Team Lead
  info += `- ${teamLead.designation}: ${teamLead.name}\n`;
  info += `  Email: ${teamLead.email} | Phone: ${teamLead.phone}\n`;
  info += `  Joined: ${teamLead.joiningDate}\n\n`;
  
  // Developers (show key ones)
  info += "DEVELOPMENT TEAM MEMBERS:\n";
  developers.forEach((dev) => {
    const email = dev.email !== "N/A" ? dev.email : "Contact through team lead";
    const phone = dev.phone !== "N/A" ? dev.phone : "Contact through team lead";
    const skills = Array.isArray(dev.skills) ? dev.skills.join(", ") : (dev.skills !== "N/A" ? dev.skills : "Various skills");
    info += `- ${dev.designation}: ${dev.name}\n`;
    info += `  Email: ${email} | Phone: ${phone}\n`;
    info += `  Skills: ${skills}\n`;
    info += `  Joined: ${dev.joiningDate !== "N/A" ? dev.joiningDate : "N/A"}\n\n`;
  });
  
  return info;
};

const getKeyContacts = () => {
  const ceo = teamData.team.executives.find(exec => exec.designation.includes("CEO"));
  const coo = teamData.team.executives.find(exec => exec.designation.includes("COO"));
  const hr = teamData.team.hr[0];
  const teamLead = teamData.team.engineering.teamLead;
  
  return {
    ceo: ceo ? `${ceo.name} (${ceo.email !== "N/A" ? ceo.email : "Contact through HR"})` : "N/A",
    coo: coo ? `${coo.name} (${coo.email})` : "N/A",
    hr: `${hr.name} (${hr.email})`,
    teamLead: `${teamLead.name} (${teamLead.email})`
  };
};

const findTeamMember = (query: string) => {
  const searchTerm = query.toLowerCase();
  let results: any[] = [];
  
  // Search executives
  teamData.team.executives.forEach(exec => {
    if (exec.name.toLowerCase().includes(searchTerm) || 
        exec.designation.toLowerCase().includes(searchTerm)) {
      results.push(exec);
    }
  });
  
  // Search HR
  teamData.team.hr.forEach(hr => {
    if (hr.name.toLowerCase().includes(searchTerm) || 
        hr.designation.toLowerCase().includes(searchTerm)) {
      results.push(hr);
    }
  });
  
  // Search engineering team
  if (teamData.team.engineering.teamLead.name.toLowerCase().includes(searchTerm) ||
      teamData.team.engineering.teamLead.designation.toLowerCase().includes(searchTerm)) {
    results.push(teamData.team.engineering.teamLead);
  }
  
  teamData.team.engineering.developers.forEach(dev => {
    if (dev.name.toLowerCase().includes(searchTerm) || 
        dev.designation.toLowerCase().includes(searchTerm)) {
      results.push(dev);
    }
  });
  
  return results;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages, selectedDoc } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response("Invalid input: messages array is required.", { status: 400 });
    }

    const currentMessage = messages[messages.length - 1];
    
    if (!currentMessage?.content || typeof currentMessage.content !== "string") {
      return new Response("Invalid input: missing user message.", { status: 400 });
    }

    const chatHistory = messages.slice(0, -1).map((msg: any) => {
      if (msg.role === "user") {
        return new HumanMessage(msg.content);
      } else if (msg.role === "assistant") {
        return new AIMessage(msg.content);
      } else {
        return new AIMessage(msg.content);
      }
    });

    console.log(`📊 Chat history length: ${chatHistory.length} messages`);
    console.log(`📊 Current question: ${currentMessage.content.slice(0, 100)}...`);

    const collectionName = 'company-policy';

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

    // ✅ Get key contacts for easy reference
    const contacts = getKeyContacts();

    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are BXTrack Solutions' official company policy assistant, specialized in helping employees understand and navigate company policies, procedures, and workplace guidelines.

**COMPANY CONTEXT:**
- BXTrack Solutions operates on a 5-day work week (Monday-Friday) with weekends off
- Salary calculations are based on working days only
- Office hours: 9:00 AM to 6:00 PM with a break from 1:20 PM to 2:20 PM
- Current policy version: 2.0 (Effective January 01, 2025)
- Total employees: ${teamData.companyInfo.totalEmployees}
- Departments: ${teamData.companyInfo.departments.join(", ")}

${getTeamInfo()}

**KEY CONTACTS SUMMARY:**
- CEO: ${contacts.ceo}
- COO: ${contacts.coo}  
- HR Manager: ${contacts.hr}
- Engineering Team Lead: ${contacts.teamLead}

**HR CONTACT AND COMPLAINT PROCEDURES:**
IMPORTANT: When users ask about ANY of the following topics, you MUST include the official HR form link:
- Filing complaints, harassment, workplace misconduct, discrimination issues
- Policy violations, workplace conflicts, sexual harassment, violence prevention
- Reporting inappropriate behavior, any HR intervention, contact HR requests

**OFFICIAL HR COMPLAINT/FEEDBACK FORM:**
For complaints, harassment reports, or any HR-related issues, please use our official form:
🔗 HR Complaint & Issue Report Form: https://forms.clickup.com/90181206829/f/2kzkg0td-10258/3WYNNN7E81MOZIOBRJ

Alternative contact: hr@bxtrack.com

**TEAM-RELATED QUERY HANDLING:**
- For "who is" questions: Provide name, designation, contact info, and joining date if available
- For "contact" questions: Give email and phone (if not N/A), otherwise refer to appropriate contact
- For "team lead" or "manager" questions: Refer to appropriate department head
- For technical issues: Direct to ${contacts.teamLead}
- For HR matters: Direct to ${contacts.hr} and provide HR form
- For executive decisions: Mention CEO ${contacts.ceo.split(' (')[0]}
- For operations: Refer to COO ${contacts.coo.split(' (')}

**MANDATORY SALARY CALCULATION REQUIREMENTS:**
IMPORTANT: For ANY salary calculation question, you MUST:
1. ALWAYS ask about unused vacation days if not provided
2. ALWAYS include unused vacation days compensation in the final calculation
3. ALWAYS show the complete calculation including all deductions AND additions
4. Assume 2 unused vacation days per month if user doesn't specify (as per company policy of 2 leaves per month)

**SALARY CALCULATION FORMAT:**
When calculating salaries, you MUST use this exact format and ALWAYS include unused vacation compensation:

SALARY CALCULATION:
   - Monthly Salary: [amount]
   - Daily Salary: [monthly salary] ÷ [working days] = [daily rate]

LEAVE DEDUCTIONS (if applicable):
   - Number of leaves taken: [number]
   - Extra leaves requiring deduction: [number]
   - Deduction amount: [calculation]

LATE ARRIVAL DEDUCTION (if applicable):
   - Late arrival time: [time]
   - Deduction rate: [percentage] of one day's salary
   - Deduction amount: [calculation]

**UNUSED VACATION DAYS COMPENSATION (MANDATORY - ALWAYS INCLUDE):**
   - Unused vacation days: [if not specified, assume based on leaves taken vs. 2 monthly allowance]
   - Compensation rate: One day's salary per unused day
   - Additional payment: [number of unused days] × [daily salary] = [amount]

TOTAL DEDUCTIONS:
   - [List all deductions]
   - TOTAL DEDUCTIONS: [sum]

TOTAL ADDITIONS:
   - Unused vacation compensation: [amount]
   - TOTAL ADDITIONS: [amount]

FINAL SALARY:
   - Base salary: [amount]
   - Minus deductions: -[amount]
   - Plus additions: +[amount]
   - FINAL SALARY: [complete calculation]

**RESPONSE FORMATTING RULES:**
- Use clear, plain text formatting without markdown symbols
- Use bullet points (•) for policy lists
- Use UPPERCASE for emphasis instead of bold formatting
- Structure calculations in a clear, organized manner
- Use proper indentation and spacing for readability

**RESPONSE GUIDELINES:**
- For ANY salary question, ALWAYS include unused vacation compensation calculation
- For ANY complaint/HR question, ALWAYS include the official HR form link
- For team questions, provide complete contact information when available
- If contact info is "N/A", guide users to appropriate alternative contacts
- Reference specific policy sections when applicable
- Maintain conversation continuity by acknowledging previous questions when relevant
- Use a professional yet friendly tone appropriate for workplace communication
- If information isn't in the policies or team directory, clearly state: "I don't have that specific information. Please contact HR using the form above or email hr@bxtrack.com for clarification."

CONTEXT:
{context}`,
      ],
      new MessagesPlaceholder("chat_history"),
      ["human", "{question}"],
    ]);

    const chain = RunnableSequence.from([
      {
        context: async (input) => {
          try {
            const docs = await retriever.getRelevantDocuments(input.question);
            
            // ✅ Add team-specific context based on query
            let teamContext = "";
            const query = input.question.toLowerCase();
            
            if (query.includes("who") || query.includes("contact") || 
                query.includes("team") || query.includes("manager") ||
                query.includes("lead") || query.includes("ceo") || 
                query.includes("coo") || query.includes("hr")) {
              
              // Try to find specific team member if name is mentioned
              const searchResults = findTeamMember(input.question);
              if (searchResults.length > 0) {
                teamContext = "\n\nRELEVANT TEAM MEMBERS:\n";
                searchResults.forEach(member => {
                  teamContext += `- ${member.name}: ${member.designation}\n`;
                  teamContext += `  Email: ${member.email !== "N/A" ? member.email : "Contact through HR"}\n`;
                  teamContext += `  Phone: ${member.phone !== "N/A" ? member.phone : "Contact through HR"}\n`;
                  if (member.joiningDate !== "N/A") {
                    teamContext += `  Joined: ${member.joiningDate}\n`;
                  }
                  teamContext += "\n";
                });
              }
            }
            
            const context = docs.length
              ? docs.map((doc) => doc.pageContent).join("\n\n") + teamContext
              : "No relevant policy documents found." + teamContext;
            
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

    const stream = await chain.stream({
      question: currentMessage.content,
      chat_history: chatHistory,
    });

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
