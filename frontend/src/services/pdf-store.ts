const DB_NAME = "maxcavator-files";
const STORE_NAME = "pdfs";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export const pdfStore = {
    async savePdf(docId: string, file: File): Promise<void> {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).put(
                { blob: file, name: file.name, type: file.type },
                docId
            );
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },

    async getPdf(docId: string): Promise<File | null> {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(docId);
            request.onsuccess = () => {
                const result = request.result;
                if (!result) return resolve(null);
                const file = new File([result.blob], result.name, { type: result.type });
                resolve(file);
            };
            request.onerror = () => reject(request.error);
        });
    },

    async deletePdf(docId: string): Promise<void> {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            tx.objectStore(STORE_NAME).delete(docId);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    },
};
