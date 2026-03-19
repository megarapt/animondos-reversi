/**
 * I18N MODULE
 * Manages application localization, browser language detection, 
 * and dynamic DOM translation.
 */
export const i18n = {
    currentLang: 'en', // Default fallback language
    locales: {},

    /**
     * Initializes the i18n system by fetching the translation dictionary
     * and detecting the user's preferred language.
     */
    init: async function() {
        try {
            // Fetch dictionary (Ensure path matches your Webpack dist structure)
            const response = await fetch('data/translations.json');
            if (!response.ok) throw new Error("Could not fetch translations.json");
            
            this.locales = await response.json();
            
            // Detect browser language and prioritize Spanish if applicable, otherwise English
            const userLang = navigator.language || navigator.userLanguage;
            this.currentLang = userLang.startsWith('es') ? 'es' : 'en';
            
            // Translate static elements already present in the DOM
            this.translateDOM();
            
            console.log(`i18n initialized. Current language set to: ${this.currentLang}`);
        } catch (error) {
            console.error("Critical failure during i18n initialization:", error);
        }
    },

    /**
     * Translates a given key.
     * Supports placeholders using curly braces, e.g., {name}.
     * 
     * @param {string} key - The translation key from the JSON file.
     * @param {Object} params - Key-value pairs to replace placeholders.
     * @returns {string} The translated text or the key if not found.
     */
    t: function(key, params = {}) {
        let text = this.locales[this.currentLang] && this.locales[this.currentLang][key] 
                   ? this.locales[this.currentLang][key] 
                   : key; // Returns the key itself as a fallback for debugging
        
        // Dynamic placeholder replacement (e.g., "{v}" -> "1.0.0")
        for (const [k, v] of Object.entries(params)) {
            text = text.replace(new RegExp(`{${k}}`, 'g'), v);
        }
        
        return text;
    },

    /**
     * Scans the document for elements with the [data-i18n] attribute
     * and injects the corresponding translation.
     */
    translateDOM: function() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            el.textContent = this.t(key);
        });
    }
};