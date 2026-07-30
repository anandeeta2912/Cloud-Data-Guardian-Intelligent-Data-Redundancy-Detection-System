export const detectPII = (data: Record<string, any>): Record<string, number> => {
  const str = JSON.stringify(data);
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
  const creditCardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;

  return {
    emails: (str.match(emailRegex) || []).length,
    phones: (str.match(phoneRegex) || []).length,
    ssn: (str.match(ssnRegex) || []).length,
    creditCards: (str.match(creditCardRegex) || []).length,
  };
};
