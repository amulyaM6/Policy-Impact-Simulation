from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_community.vectorstores import Chroma
import threading
from collections import OrderedDict

embeddings = HuggingFaceEmbeddings(
    model_name="all-MiniLM-L6-v2",
    model_kwargs={"device": "cpu"}
)

# In-memory stores, built once and reused for all retrieval queries
_STORES: "OrderedDict[str, Chroma]" = OrderedDict()
_LOCK = threading.Lock()
_MAX_STORES = 4


def chunk_text(text: str) -> list[str]:
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,
        chunk_overlap=50,
        separators=["\n\n", "\n", ".", " "]
    )
    return splitter.split_text(text)


def store_chunks(chunks: list[str], collection_name: str = "policy") -> Chroma:
    store = Chroma.from_texts(
        texts=chunks,
        embedding=embeddings,
        collection_name=collection_name,   # no persist_directory -> in memory
    )
    with _LOCK:
        _STORES[collection_name] = store
        while len(_STORES) > _MAX_STORES:
            _, old = _STORES.popitem(last=False)
            try:
                old.delete_collection()
            except Exception:
                pass
    return store


def retrieve_chunks(query: str, collection_name: str = "policy", k: int = 3) -> str:
    store = _STORES.get(collection_name)
    if store is None:
        return ""
    results = store.similarity_search(query, k=k)
    return "\n\n".join(doc.page_content for doc in results)


def cleanup_old_collections(max_age_seconds: int = 3600):
    return  # nothing is written to disk any more


def build_rag(text: str, collection_name: str = "policy") -> None:
    chunks = chunk_text(text)
    store_chunks(chunks, collection_name)
    print(f"✅ RAG ready: {len(chunks)} chunks stored in '{collection_name}'")