import { NextRequest, NextResponse } from 'next/server';
import { searchGoogle, scrapeUrl } from '@/lib/firecrawl';
import { generateCompletion } from '@/lib/llm';
import { saveToDrive } from '@/lib/drive';

export const runtime = 'nodejs'; // Required for some node APIs if not edge

export async function POST(req: NextRequest) {
    const { keyword } = await req.json();

    if (!keyword) {
        return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const sendUpdate = (step: number, message: string, data?: any) => {
                const payload = JSON.stringify({ step, message, data });
                controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
            };

            try {
                // Step 1: Keyword Received
                sendUpdate(1, `Keyword received: ${keyword}`);

                // Step 2: Firecrawl Search
                sendUpdate(2, "Searching Google for top results...");
                const searchResults = await searchGoogle(keyword, 3);

                // Step 3: Extract URLs
                sendUpdate(3, `Found ${searchResults.length} top articles`, searchResults);
                const urls = searchResults.map(r => r.url);

                // Step 4-7: Scrape & Clean
                let combinedContent = "";
                for (const url of urls) {
                    sendUpdate(4, `Scraping content from: ${url}`);
                    // Step 5: Get content
                    const rawContent = await scrapeUrl(url);

                    // Step 6: Clean (Firecrawl Markdown is already decent, passing through)
                    // We append it to combined content
                    if (rawContent) {
                        combinedContent += `\n\n--- Source: ${url} ---\n\n${rawContent}`;
                    }
                }
                sendUpdate(7, "All contents scraped and cleaned.");

                // Step 8: Combine
                sendUpdate(8, "Combined content prepared for analysis.");

                let finalDocumentContent = "";
                let documentTitle = "";

                if (process.env.GEMINI_API_KEY) {
                    // --- AI WORKFLOW ---

                    // Step 9: Data Extraction & Summarize
                    sendUpdate(9, "Extracting and summarizing key information (via Gemini)...");
                    const summaryPrompt = `
**Role**: A precise data extractor and summarizer.

**Instructions**: Analyze the body text provided from scraped web pages about "${keyword}" and produce a structured, detailed summary of key information contained within. Focus on identifying unique, relevant, and actionable insights that align with the goal of informing a high-quality blog post.

**Steps**:
1. **Input Analysis**: Examine the combined body text input from the web pages provided.
2. **Topic Identification**: Determine the overarching themes or topics discussed in the combined text.
3. **Content Extractions**: Extract key details such as:
   - Major points or arguments.
   - Supporting facts, statistics, or evidence.
   - Unique insights or perspectives.
4. **Organized Summary**: Structure the information in a format that is easy to use for a blog writer. Use sections like:
   - Introduction/Overview.
   - Key Insights/Findings (list format).
   - Supporting Evidence/Examples.
   - Implications or Potential Applications.
5. **Clarity and Relevance**: Ensure the summary is concise, devoid of unnecessary repetition, and directly relevant to producing a blog post. 

**End Goal**: To generate a coherent and detailed summary that contains all the critical information from the input text. This summary will serve as the foundational content for the subsequent blog-writing step.

**Narrowing**: Emphasize extracting content that provides depth and value for readers, such as unique data points, expert opinions, or practical applications. Avoid duplicating generic information, and instead highlight specifics unique to the combined web pages. 

**Required Output Structure**:

**Overview**
[Brief description of the overall topic(s) covered in the web pages.]

**Key Insights/Findings**
- [Insight 1]
- [Insight 2]
- [Insight 3]
(Include more as needed)

**Supporting Evidence/Examples**
1. [Fact or example from source 1]
2. [Fact or example from source 2]
3. [Fact or example from source 3]
(Include more as needed)

**Implications or Applications**
[Analysis of how the information could be applied or its broader implications.]

---

**Content to Analyze**:
${combinedContent.slice(0, 20000)}
                    `;
                    const summary = await generateCompletion(summaryPrompt);
                    sendUpdate(9, "Data extraction and summary completed.", { summary });

                    // Step 10: Write Article
                    sendUpdate(10, "Drafting the full SEO article (via Gemini)...");
                    const writePrompt = `
**Role**: You are an experienced SEO Content Writer with expertise in crafting high-quality, search engine-optimized articles. You are skilled at analyzing competitive content and creating superior versions that outshine the existing top results.

**Instructions**: You'll receive a summary that contains the key content extracted from the top-ranking SERP results for "${keyword}". This factual information represents what is already performing well in search engine results. Your task is to take this content, analyze it, and craft a blog article that is not only engaging and informative but also outperforms these competitors in terms of value, depth, and user experience.

**Steps**:

1. **Content Analysis**:
   - Review the summary thoroughly, which contains the best information from top-ranking pages.
   - Identify areas where the existing content can be improved in terms of depth, clarity, and value.
   - Take note of any gaps or overlooked points in the competitor's content that you can address.

2. **Structuring the Article**:
   - Organize the content into a well-structured format, with a clear introduction, engaging body, and a strong conclusion.
   - Ensure each section is optimized for readability, with logical flow and appropriate use of headers (H1, H2, H3) for easy navigation.
   - Break down complex information into digestible chunks, using short paragraphs, bullet points and numbered lists where appropriate.

3. **Enhancing Readability**:
   - Write in a conversational, easy-to-understand tone while maintaining professionalism and authority.
   - Use transition words and varied sentence lengths to keep the reader engaged.
   - Avoid jargon or overly complex terms unless they add value, and provide definitions or explanations for technical terms.

4. **SEO Optimization**:
   - Integrate relevant primary and secondary keywords naturally throughout the article to improve rankings.
   - Ensure keyword usage is contextually relevant and does not disrupt the natural flow of the content.
   - Optimize for on-page SEO by suggesting where internal links and external authoritative references could be placed.

5. **Adding Unique Value**:
   - Provide actionable insights, real-world examples, or tips that add unique value to the reader, going beyond what is offered in the current top-ranking content.
   - Include data, case studies, or expert quotes to support your points and further differentiate your article from competitors.
   - Where applicable, suggest multimedia placements (images, graphs, charts) to enhance comprehension and engagement.

6. **Final Review**:
   - Double-check the article for grammar, spelling, and consistency.
   - Make sure all content is fact-checked and up-to-date with the most relevant, accurate information.
   - Review the tone and readability to ensure it appeals to the target audience, balancing SEO needs with user engagement.

**End Goal**: Create a superior, SEO-optimized blog article that not only outranks the current top competitors but also provides more value, engages the reader, and is easily digestible. The content should be authoritative, well-researched, and designed to convert visitors into loyal readers or customers.

**Narrowing**: Focus strictly on factual information from the top-ranking pages, improving and expanding upon it. Avoid including off-topic or unrelated content. Stay aligned with the search intent of the target audience, which is to find actionable, in-depth, and reliable information on the topic. Do not overstuff keywords: ensure the writing flows naturally and is reader-focused.

**Output Format**: 
- Output ONLY clean Markdown text
- Use proper Markdown heading structure (# for H1, ## for H2, ### for H3)
- Do NOT wrap in code blocks or use \`\`\`markdown
- Do NOT output HTML tags
- Start directly with the H1 title

**Research Summary to Use**:
${summary}

Write the article now:
`;
                    const initialDraft = await generateCompletion(writePrompt);

                    // Step 11: Humanize
                    sendUpdate(11, "Refining tone to sound more human...");
                    const refinePrompt = `
**Role**: You are a skilled human-like writing assistant, tasked with transforming blog content into highly engaging, empathetic, and conversational writing without altering its factual or structural integrity.

**Instructions**: You'll receive content from the Blog Writer. Your goal is to refine the tone, style, and flow of this content to make it feel more human, approachable, and relatable while adhering to these guidelines:

**Core Guidelines**:

1. **Preserve Factual Accuracy and Structure**:
   - Maintain the original facts, structure, and organization of the content.
   - Focus solely on tone and language adjustments.

2. **Humanized Word Choice**:
   - Rewrite the text with a more conversational and engaging tone.
   - Use natural, reader-friendly language while maintaining clarity and professionalism.
   - Avoid overly complex words or jargon, and make it feel like a friendly conversation rather than a formal essay.
   - Where appropriate, add warmth, storytelling, and relatable examples to keep the reader engaged.
   - Vary paragraph lengths to maintain reader interest.

3. **Value-Driven Content**:
   - Eliminate fluff. Every sentence should contribute meaningful information, insight, or emotional connection.

4. **Stylistic Improvements**:
   - Use active voice wherever possible.
   - Avoid clichés, repetitive phrases, and awkward transitions.
   - Add relatable examples or brief anecdotes where appropriate, enhancing the reader's emotional connection to the content.

**Prohibited Language**:
- **Limit Words**: Avoid using the words "unique," "ensure," and "utmost" more than three times.
- **Forbidden Words**: Avoid these entirely: "meticulous," "complexities," "bespoke," "tailored," "underpins," "amongst," "the secrets," "unveil the secrets," "robust," and similar overused or corporate terms.
- Avoid passive voice constructions. Always aim for clarity and engagement.

**Examples of Transformation**:
- Before: "This tool can improve your workflow."
- After: "Picture yourself gliding through your tasks with ease, thanks to a tool that takes the heavy lifting off your plate."

- Before: "It is advisable to review all options before making a decision."
- After: "Take a moment to consider your choices—what works best for you?"

**End Goal**: Produce content that feels natural, engaging, and human while staying aligned with the original structure and facts. Aim to captivate readers, keep their attention, and foster a genuine connection. Always prioritize readability, relatability, and emotional resonance.

**Output Format**: 
- Output ONLY clean Markdown text
- Maintain the Markdown heading structure (# ## ###)
- Do NOT wrap in code blocks or use \`\`\`markdown
- Do NOT output HTML tags
- Do NOT include meta-commentary about your changes
- Start directly with the H1 title

**Article to Refine**:
${initialDraft}

Write the refined article now:
`;
                    const finalArticle = await generateCompletion(refinePrompt);
                    sendUpdate(11, "Article refined.", { article: finalArticle });

                    finalDocumentContent = finalArticle;
                    documentTitle = `${keyword} - SEO Article`;

                } else {
                    // --- NO AI FALLBACK ---
                    sendUpdate(9, "Gemini key missing. Skipping AI generation steps.");
                    sendUpdate(10, "Compiling raw research report...");

                    finalDocumentContent = `# Research Report: ${keyword}\n\nGenerated on ${new Date().toISOString()}\n\n${combinedContent}`;
                    documentTitle = `${keyword} - Research Report`;

                    // Skip step 11 visually or mark done implicitly by jumping to 12
                    sendUpdate(11, "Skipped refinement (No AI).");
                }

                // Step 12: Save to Drive
                let driveLink = "";
                if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
                    sendUpdate(12, `Saving "${documentTitle}" to Google Drive...`);
                    try {
                        driveLink = await saveToDrive(finalDocumentContent, documentTitle);
                    } catch (e) {
                        console.error("Drive upload failed:", e);
                        sendUpdate(12, "Drive upload failed. Preparing download...");
                    }
                } else {
                    sendUpdate(12, "Google Drive skipped (no credentials). Preparing download...");
                }

                sendUpdate(12, "Process completed!", {
                    resultLink: driveLink,
                    content: finalDocumentContent,
                    filename: `${documentTitle}.md`
                });
                controller.close();

            } catch (error) {
                console.error("Workflow error:", error);
                sendUpdate(0, "Error occurred during workflow execution.");
                controller.close();
            }
        }
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    });
}
