export const countryToFlagCode = {
    "United States": "us",
    "United Kingdom": "gb", 
    "Jamaica": "jm",
    "Venezuela": "ve",
    "Guam": "gu",
    "Austria": "at",
    "Netherlands": "nl",
    "Germany": "de",
    "France": "fr",
    "Italy": "it",
    "Spain": "es",
    "Canada": "ca",
    "Australia": "au",
    "Japan": "jp",
    "Brazil": "br"
};

export function getCountryFlag(country) {
    if (!country) return "<span class=\"flag-fallback\">🏁</span>";
    
    let countryCode = countryToFlagCode[country];
    
    if (!countryCode) {
        const lowerCountry = country.toLowerCase();
        for (const [key, code] of Object.entries(countryToFlagCode)) {
            if (key.toLowerCase() === lowerCountry) {
                countryCode = code;
                break;
            }
        }
    }
    
    if (countryCode) {
        return `<img src="https://flagcdn.com/24x18/${countryCode}.png" alt="${country}" class="flag-image" title="${country}">`;
    }
    
    return `<span class="flag-fallback" title="${country}">[${country.substring(0, 3).toUpperCase()}]</span>`;
}

export function getCountryFlagOrCode(country) {
    return getCountryFlag(country);
}
