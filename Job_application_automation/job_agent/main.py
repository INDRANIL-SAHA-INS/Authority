# Entry point for the job application automation agent
import os
import sys

# Ensure Python can resolve local imports properly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import logging
# Configure logging so ALL internal steps from the nodes are printed dynamically
logging.basicConfig(
    level=logging.INFO,
    format="    -> %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)

# Mute noisy internal HTTP logs from Langchain/OpenAI
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

from graph import graph

def run_agent(url: str, prompt: str):
    print(f"Starting Job Agent for: {url}")
    print("=" * 60)
    # Run the graph using stream() so we can see exactly which node is running
    # This is the ultimate minimal clean debugging tool.
    final_result = {}
    print("\n--- AGENT EXECUTION FLOW ---")
    
    try:
        for output in graph.stream(
            {"raw_url": url, "raw_prompt": prompt}, 
            config={"recursion_limit": 50}
        ):
            for node_name, state_update in output.items():
                print(f" [OK] Finished Step: {node_name.upper()}")
                final_result.update(state_update) # Accumulate state
                
                # If a node logged a specific error, print it immediately
                if "error" in state_update and state_update["error"]:
                    print(f"      -> ⚠️ ERROR: {state_update['error']}")
                    
    except Exception as e:
        print(f" [CRASH] The graph crashed unexpectedly!")
        print(f"      -> Exception: {e}")
    
    print("\n" + "=" * 60)
    print("FINAL AI NOTIFICATION:")
    print("----------------------")
    print(final_result.get("notification", "No notification generated."))
    print("=" * 60)

if __name__ == "__main__":
    # Test URL - Replace this with an actual Greenhouse/Lever link or job board listing!
    test_url = "https://job-boards.greenhouse.io/canonical/jobs/2804965"
    test_prompt = "Apply for this Software Engineer job for me"
    
    run_agent(test_url, test_prompt)