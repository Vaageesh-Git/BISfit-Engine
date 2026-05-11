"""
BISfit FastAPI Server
Exposes the RAG pipeline as a single-query REST API.
The eval_script.py and inference.py are untouched.
"""

import logging
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from src.pipeline.rag import RAGPipeline
import os

# Set environment variables immediately to restrict PyTorch and system memory usage
os.environ["OMP_NUM_THREADS"] = "1"
os.environ["MKL_NUM_THREADS"] = "1"
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["MALLOC_ARENA_MAX"] = "2"
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "garbage_collection_threshold:0.6,max_split_size_mb:128"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(
    title="BISfit API",
    description="RAG-powered Bureau of Indian Standards query API",
    version="1.0.0",
)

# Allow all origins for local development / demo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Load the RAG pipeline once at startup
# ---------------------------------------------------------------------------
rag: RAGPipeline | None = None


@app.on_event("startup")
async def startup_event():
    global rag
    logger.info("Initialising RAG pipeline...")
    try:
        rag = RAGPipeline(
            index_path="data/faiss_index.bin",
            metadata_path="data/chunk_metadata.json",
        )
        logger.info("RAG pipeline ready.")
    except Exception as e:
        logger.error(f"Failed to initialise RAG pipeline: {e}")
        rag = None


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------
class QueryRequest(BaseModel):
    query: str


class QueryResponse(BaseModel):
    query: str
    response: str
    retrieved_standards: list[str]
    latency_seconds: float


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def health():
    return {"status": "ok", "pipeline_ready": rag is not None}


@app.post("/query", response_model=QueryResponse)
async def query_endpoint(body: QueryRequest):
    if not body.query.strip():
        raise HTTPException(status_code=400, detail="Query must not be empty.")
    if rag is None:
        raise HTTPException(status_code=503, detail="RAG pipeline not initialised. Check server logs.")

    start = time.time()
    try:
        result = rag.process_query(body.query, top_k=5)
    except Exception as e:
        logger.error(f"Error processing query: {e}")
        raise HTTPException(status_code=500, detail=f"Pipeline error: {str(e)}")

    latency = round(time.time() - start, 4)

    return QueryResponse(
        query=body.query,
        response=result.get("response", ""),
        retrieved_standards=result.get("retrieved_standards", []),
        latency_seconds=latency,
    )


# ---------------------------------------------------------------------------
# Serve the frontend static files
# ---------------------------------------------------------------------------
frontend_dir = os.path.join(os.path.dirname(__file__), "frontend", "dist")
if os.path.isdir(frontend_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dir, "assets")), name="assets")

    @app.get("/", response_class=FileResponse)
    async def serve_frontend():
        return FileResponse(os.path.join(frontend_dir, "index.html"))

    @app.get("/favicon.svg", response_class=FileResponse)
    async def serve_favicon():
        return FileResponse(os.path.join(frontend_dir, "favicon.svg"))
