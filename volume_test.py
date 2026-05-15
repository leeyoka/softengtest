import asyncio
import httpx
import time
import matplotlib.pyplot as plt

# --- CONFIGURATION ---
# Replace with your deployed App URL
TARGET_URL = "https://eat-medicine.vercel.app/pose" 
CONCURRENCY_LEVEL = 10
TOTAL_REQUESTS = 50
# ---------------------

async def send_request(client, request_id):
    start_time = time.perf_counter()
    try:
        # Simulating a forensic scan request
        # In Aegis, this would hit your Gemini Proxy route
        response = await client.post(
            TARGET_URL,
            json={"image": "base64_data_placeholder"}
        )
        end_time = time.perf_counter()
        latency = end_time - start_time
        return {"id": request_id, "latency": latency, "status": response.status_code}
    except Exception as e:
        end_time = time.perf_counter()
        return {"id": request_id, "latency": end_time - start_time, "status": "ERROR"}

async def run_test():
    print(f"🚀 Starting Volume Test: {TOTAL_REQUESTS} requests @ {CONCURRENCY_LEVEL} concurrency")
    
    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Create sempahore to control concurrency
        semaphore = asyncio.Semaphore(CONCURRENCY_LEVEL)
        
        async def sem_request(rid):
            async with semaphore:
                return await send_request(client, rid)

        tasks = [sem_request(i) for i in range(TOTAL_REQUESTS)]
        results = await asyncio.gather(*tasks)

    return results

def plot_results(results):
    ids = [r["id"] for r in results]
    latencies = [r["latency"] for r in results]
    
    plt.figure(figsize=(12, 6))
    plt.plot(ids, latencies, marker='o', linestyle='-', color='#22c55e', markersize=4)
    plt.title(f"Response Time Analysis - Concurrency {CONCURRENCY_LEVEL}")
    plt.xlabel("Request Number")
    plt.ylabel("Response Time (seconds)")
    plt.grid(True, linestyle='--', alpha=0.6)
    
    # Calculate stats
    avg = sum(latencies) / len(latencies)
    plt.axhline(y=avg, color='red', linestyle='--', label=f'Avg: {avg:.2f}s')
    plt.legend()
    
    print("\n--- TEST SUMMARY ---")
    print(f"Average Latency: {avg:.4f}s")
    print(f"Max Latency:     {max(latencies):.4f}s")
    print(f"Success Rate:    {len([r for r in results if r['status'] != 'ERROR'])/len(results)*100:.2f}%")
    
    plt.show()

if __name__ == "__main__":
    test_results = asyncio.run(run_test())
    plot_results(test_results)
