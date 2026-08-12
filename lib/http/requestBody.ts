export class RequestBodyTooLargeError extends Error {}

export const readTextBodyWithLimit = async (request: Request, maxBytes: number): Promise<string> => {
    const contentLength = request.headers.get("content-length");
    if (contentLength && Number(contentLength) > maxBytes) throw new RequestBodyTooLargeError();
    if (!request.body) return "";
    const reader = request.body.getReader();
    const decoder = new TextDecoder();
    let totalBytes = 0;
    let result = "";
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalBytes += value.byteLength;
            if (totalBytes > maxBytes) {
                await reader.cancel();
                throw new RequestBodyTooLargeError();
            }
            result += decoder.decode(value, { stream: true });
        }
        return result + decoder.decode();
    } finally {
        reader.releaseLock();
    }
};

export const readJsonBodyWithLimit = async (request: Request, maxBytes = 64 * 1024): Promise<unknown> =>
    JSON.parse(await readTextBodyWithLimit(request, maxBytes)) as unknown;
