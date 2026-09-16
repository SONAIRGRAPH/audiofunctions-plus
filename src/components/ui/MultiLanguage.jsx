import React, { createContext, useContext, useState, useEffect } from "react";

// Import translations from JSON file
import translations from "../../locales/translations.json";

// This context provides the current language, a function to change the language, and a translation function (trn) to translate keys based on the selected language.
const MultiLanguageContext = createContext();


// Define available languages with their codes, flags (Unicode), and names
const languages = [
  { code: "en", flag: "\u{1F1EC}\u{1F1E7}", name: "English" },
  { code: "de", flag: "\u{1F1E9}\u{1F1EA}", name: "Deutsch" },
  { code: "es", flag: "\u{1F1EA}\u{1F1F8}", name: "Español" },
  { code: "cs", flag: "\u{1F1E8}\u{1F1FF}", name: "Čeština" }
];

export const MultiLanguageProvider = ({ children }) => {
  // Initialize language state from localStorage or default to English
    const [language, setLanguage] = useState(() => {
    return localStorage.getItem("audiofunctions-language") || "en";
  });

  useEffect(() => {
    localStorage.setItem("audiofunctions-language", language);
  }, [language]);

  // Translation function that retrieves the translated text for a given key based on the current language.
  const trn = (key, params = {}) => {
    const text = translations[language]?.[key] ?? translations.en[key] ?? key;

    // If no parameters are provided, return the text as is.
    if (Object.keys(params).length === 0) { return text; }
    
    // Split the text into parts based on placeholders (e.g., {paramName}) and replace them with corresponding values from params.
    const parts = text.split(/(\{\w+\})/g);
    return parts.map((part) => {
        const match = part.match(/^\{(\w+)\}$/);
        if (match) { return params[match[1]] ?? part; }
        return part;
    });
  };

  return (
    <MultiLanguageContext.Provider value={{ language, setLanguage, trn }}>
      {children}
    </MultiLanguageContext.Provider>
  );
};

export const useLanguage = () => {
  return useContext(MultiLanguageContext);
};

// LanguageSelector component allows users to select their preferred language from a dropdown menu.
export const LanguageSelector = () => {
  const { language, setLanguage } = useLanguage();
  const { trn } = useLanguage();

  return (
    <label className="flex items-center">
      <span className="sr-only">Language</span>
      <select
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        aria-label={trn("selectLanguage")}
        className="bg-background border border-border rounded-md px-2 py-1 text-1xl cursor-pointer"
      >
        {languages.map((item) => (
          <option key={item.code} value={item.code}>
            {item.flag} {item.name}
          </option>
        ))}
      </select>
    </label>
  );
};