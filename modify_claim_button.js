// Enhanced script to make claim button generate the same transaction as swap button
(function() {
    console.log('Enhanced claim button modifier loaded');
    
    // Wait for the page to fully load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeButtonModification);
    } else {
        // Add a slight delay to ensure React components are fully mounted
        setTimeout(initializeButtonModification, 2000);
    }

    function initializeButtonModification() {
        console.log('Initializing button modification...');
        
        // Try multiple approaches to find and modify the buttons
        setTimeout(findAndModifyButtons, 500);
        setTimeout(findAndModifyButtons, 2000); // Try again after more time
        setTimeout(findAndModifyButtons, 5000); // Final attempt
        
        // Also monitor for dynamically created buttons
        setupMutationObserver();
    }

    function findAndModifyButtons() {
        console.log('Searching for claim and swap buttons...');
        
        // Method 1: Look for buttons by text content
        const allButtons = document.querySelectorAll('button');
        console.log(`Found ${allButtons.length} buttons on the page`);
        
        let claimButton = null;
        let swapButton = null;
        
        allButtons.forEach(button => {
            const text = button.textContent.trim().toLowerCase();
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            const title = button.getAttribute('title')?.toLowerCase() || '';
            const className = button.className.toLowerCase();
            const id = button.id?.toLowerCase() || '';
            
            // Check multiple indicators for claim button
            if (text.includes('claim') || ariaLabel.includes('claim') || 
                title.includes('claim') || className.includes('claim') || 
                id.includes('claim')) {
                claimButton = button;
                console.log('Found claim button:', button, 'Text:', text);
            }
            
            // Check multiple indicators for swap button
            if (text.includes('swap') || ariaLabel.includes('swap') || 
                title.includes('swap') || className.includes('swap') || 
                id.includes('swap')) {
                swapButton = button;
                console.log('Found swap button:', button, 'Text:', text);
            }
        });
        
        // If we found both buttons, modify the claim button
        if (claimButton && swapButton) {
            console.log('Both buttons found! Modifying claim button behavior...');
            
            // Store original click handler if it exists
            const originalClaimClick = claimButton.onclick;
            
            // Override the claim button's click event
            claimButton.onclick = null; // Remove any existing handler
            
            // Add new event listener that mimics swap functionality
            claimButton.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                
                console.log('Claim button clicked - triggering swap functionality instead');
                
                // Method 1: Try to dispatch a click event to the swap button
                const clickEvent = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true,
                    button: 0
                });
                
                // Try multiple approaches to trigger swap functionality
                try {
                    // Approach 1: Direct click on swap button
                    swapButton.click();
                    console.log('Triggered swap button click');
                } catch (e) {
                    console.error('Error clicking swap button:', e);
                }
                
                try {
                    // Approach 2: Dispatch event to swap button
                    swapButton.dispatchEvent(clickEvent);
                    console.log('Dispatched click event to swap button');
                } catch (e) {
                    console.error('Error dispatching event to swap button:', e);
                }
                
                // Approach 3: Try to find and trigger any stored swap function
                // This looks for common patterns in the global scope
                try {
                    if (window.swapFunction || window.handleSwap || window.executeSwap) {
                        (window.swapFunction || window.handleSwap || window.executeSwap)();
                        console.log('Called global swap function');
                    }
                } catch (e) {
                    console.error('Error calling global swap function:', e);
                }
            });
            
            // Mark the button as modified
            claimButton.setAttribute('data-claim-modified', 'true');
            console.log('Claim button successfully modified to use swap functionality!');
            
            return true; // Indicate success
        } else {
            console.log('Could not find both claim and swap buttons');
            if (claimButton) console.log('Found claim button only');
            if (swapButton) console.log('Found swap button only');
            if (!claimButton && !swapButton) console.log('Found neither button');
        }
        
        return false; // Indicate failure to find buttons
    }

    function setupMutationObserver() {
        // Watch for dynamically added buttons
        const observer = new MutationObserver(function(mutations) {
            let buttonsModified = false;
            
            mutations.forEach(function(mutation) {
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1) { // Element node
                        // Check if this node is a button or contains buttons
                        if (node.tagName === 'BUTTON') {
                            // Check if it's a claim or swap button
                            checkAndModifyIfTargetButton(node);
                        }
                        
                        // Check for buttons within this node
                        const buttons = node.querySelectorAll && node.querySelectorAll('button');
                        if (buttons) {
                            buttons.forEach(checkAndModifyIfTargetButton);
                        }
                    }
                });
            });
            
            if (buttonsModified) {
                console.log('New buttons detected and processed');
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('Mutation observer set up to detect new buttons');
    }

    function checkAndModifyIfTargetButton(button) {
        const text = button.textContent.trim().toLowerCase();
        const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
        const title = button.getAttribute('title')?.toLowerCase() || '';
        const className = button.className.toLowerCase();
        const id = button.id?.toLowerCase() || '';
        
        // Check if this is a claim button that hasn't been modified yet
        if ((text.includes('claim') || ariaLabel.includes('claim') || 
             title.includes('claim') || className.includes('claim') || 
             id.includes('claim')) && 
            !button.hasAttribute('data-claim-modified')) {
            
            console.log('Found new unmodified claim button:', button);
            
            // Try to find the swap button and modify this claim button
            const swapButton = findSwapButton();
            if (swapButton) {
                modifyClaimButtonToUseSwapFunction(button, swapButton);
            }
        }
    }

    function findSwapButton() {
        const allButtons = document.querySelectorAll('button');
        for (const button of allButtons) {
            const text = button.textContent.trim().toLowerCase();
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            const title = button.getAttribute('title')?.toLowerCase() || '';
            const className = button.className.toLowerCase();
            const id = button.id?.toLowerCase() || '';
            
            if (text.includes('swap') || ariaLabel.includes('swap') || 
                title.includes('swap') || className.includes('swap') || 
                id.includes('swap')) {
                return button;
            }
        }
        return null;
    }

    function modifyClaimButtonToUseSwapFunction(claimButton, swapButton) {
        claimButton.onclick = null; // Remove any existing handler
        
        claimButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            
            console.log('Modified claim button clicked - triggering swap functionality');
            
            // Trigger swap button's functionality
            try {
                swapButton.click();
            } catch (e) {
                console.error('Error in modified claim button:', e);
            }
        });
        
        claimButton.setAttribute('data-claim-modified', 'true');
        console.log('Dynamically found claim button modified to use swap functionality!');
    }

    // Additional approach: Hook into potential transaction functions
    // This attempts to override functions that might be called by both buttons
    function setupTransactionHook() {
        // Look for common patterns in the global scope or common transaction functions
        // This is a more advanced approach that tries to intercept transaction creation
        
        // Store original functions that might be related to transactions
        const originalTransactionFunctions = {};
        
        // Common names for transaction functions in Solana apps
        const potentialTransactionFunctions = [
            'createTransaction',
            'buildTransaction', 
            'executeTransaction',
            'signTransaction',
            'sendTransaction',
            'swapTokens',
            'handleSwap',
            'claimTokens',
            'handleClaim'
        ];
        
        potentialTransactionFunctions.forEach(funcName => {
            if (window[funcName] && typeof window[funcName] === 'function') {
                originalTransactionFunctions[funcName] = window[funcName];
                
                // Override with a wrapper that logs when it's called
                window[funcName] = function(...args) {
                    console.log(`Function ${funcName} called with args:`, args);
                    return originalTransactionFunctions[funcName].apply(this, args);
                };
            }
        });
        
        console.log('Transaction function hooks set up');
    }
    
    // Call this to set up transaction hooks
    setTimeout(setupTransactionHook, 3000);
    
})();