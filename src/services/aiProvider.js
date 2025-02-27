import OpenAI from 'openai';
import config from '../../config/default.js';

class AIProvider {
    async generateCompletion(prompt) {
        console.log('generateCompletion')
        throw new Error('generateCompletion must be implemented');
    }
}

class OpenAIProvider extends AIProvider {
    constructor(apiKey) {
        super();
        this.openai = new OpenAI({ apiKey });
    }

    async generateCompletion(prompt) {
        const completion = await this.openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [{ role: "system", content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.2
        });
        return JSON.parse(completion.choices[0].message.content);
    }
}

class OllamaProvider extends AIProvider {
    constructor(_config) {
        super();
        this.baseUrl = `http://${_config.url}:${_config.port}`;
        this.model = _config.model;
        this.maxRetries = 3;
        this.timeout = 6000000; // 30 secondes
    }

    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

    async generateCompletion(prompt) {
        console.log('Sending request to:', this.baseUrl);
        console.log('Using model:', this.model);
        
        let lastError;
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                const response = await this.fetchWithTimeout(`${this.baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: this.model,
                        prompt: prompt + "\n\nRéponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après.",
                        stream: false
                    }),
                });

                if (!response.ok) {
                    throw new Error(`Ollama API error: ${response.statusText}`);
                }

                const data = await response.json();
                try {
                    const jsonStr = data.response.replace(/^[^{]*({.*})[^}]*$/s, '$1');
                    return JSON.parse(jsonStr);
                } catch (error) {
                    throw new Error('Invalid JSON response from Ollama');
                }
            } catch (error) {
                console.log('error', error);
                console.error(`Attempt ${attempt} failed:`, error.message);
                lastError = error;

                if (attempt < this.maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff with max 5s
                    console.log(`Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }

        throw new Error(`Failed after ${this.maxRetries} attempts. Last error: ${lastError.message}`);
    }
}

// Ajoutez d'autres fournisseurs ici, par exemple MistralProvider

function getAIProvider(providerName) {
    switch (providerName) {
        case 'openai':
            return new OpenAIProvider(config.ia.openAi.key);
        case 'ollama':
            return new OllamaProvider(config.ia.ollama);
        // case 'mistral':
        //   return new MistralProvider(config.mistral.key);
        default:
            throw new Error('Unknown AI provider');
    }
}

export default getAIProvider;