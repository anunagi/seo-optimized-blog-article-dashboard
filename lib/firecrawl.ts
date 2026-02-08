const apiKey = process.env.FIRECRAWL_API_KEY;

if (!apiKey) {
    console.warn("FIRECRAWL_API_KEY is not set");
}

export type SearchResult = {
    url: string;
    title: string;
    description: string;
};

export async function searchGoogle(query: string, limit: number = 3): Promise<SearchResult[]> {
    try {
        const response = await fetch("https://api.firecrawl.dev/v0/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                query: query,
                pageOptions: {
                    fetchPageContent: false
                },
                searchOptions: {
                    limit: limit
                }
            })
        });

        if (!response.ok) {
            console.error("Firecrawl search failed", await response.text());
            return [];
        }

        const data = await response.json();

        if (!data.data) {
            return [];
        }

        // Map to simple structure
        return data.data.map((item: any) => ({
            url: item.url,
            title: item.title,
            description: item.description || "",
        }));
    } catch (error) {
        console.error("Firecrawl search error:", error);
        throw error;
    }
}

export async function scrapeUrl(url: string): Promise<string> {
    try {
        const response = await fetch("https://api.firecrawl.dev/v0/scrape", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                url: url,
                formats: ['markdown']
            })
        });

        if (!response.ok) {
            throw new Error(`Firecrawl scrape failed: ${await response.text()}`);
        }

        const data = await response.json();

        if (!data.data || !data.data.markdown) {
            throw new Error(`No markdown content found for ${url}`);
        }

        return data.data.markdown;
    } catch (error) {
        console.error(`Firecrawl scrape error for ${url}:`, error);
        return ""; // Return empty string on failure to allow workflow to continue
    }
}
