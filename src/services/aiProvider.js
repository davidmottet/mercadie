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

// Ajoutez d'autres fournisseurs ici, par exemple MistralProvider

function getAIProvider(providerName) {
    switch (providerName) {
        case 'openai':
            return new OpenAIProvider(config.ia.openAi.key);
        // case 'mistral':
        //   return new MistralProvider(config.mistral.key);
        default:
            throw new Error('Unknown AI provider');
    }
}

export default getAIProvider;