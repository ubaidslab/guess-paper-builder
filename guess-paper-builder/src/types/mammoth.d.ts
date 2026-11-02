// mammoth ke browser build ke liye type declaration (package mein types nahi hain).
declare module "mammoth/mammoth.browser.js" {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  const mammoth: {
    extractRawText(options: { arrayBuffer: ArrayBuffer }): Promise<ExtractResult>;
  };
  export default mammoth;
}
