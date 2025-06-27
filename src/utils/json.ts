export function safeParseJson(jsonString: string) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    // First try to clean up the string (remove any surrounding quotes if present)
    const cleanedString = jsonString.trim().replace(/^(['"])(.*)\1$/, '$2');
    try {
      return JSON.parse(cleanedString);
    } catch (innerError) {
      throw new Error(
        `Failed to parse JSON: ${(error as Error).message}. Make sure to provide valid JSON without surrounding quotes.`,
      );
    }
  }
}
