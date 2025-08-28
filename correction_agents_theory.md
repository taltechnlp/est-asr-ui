A Strategic Framework for High-Reliability ASR Error Correction Using LLM Agents, N-best Lists, and External Tools
I. Foundational Principles of LLM-based ASR Post-Processing
The task of correcting errors produced by Automatic Speech Recognition (ASR) systems has evolved from a simple post-processing step into a complex reasoning challenge. The advent of Large Language Models (LLMs) has opened new paradigms for this task, moving beyond statistical language model rescoring to sophisticated generative correction. However, harnessing the power of LLMs for this purpose requires a deep understanding of the ASR error landscape, the strategic use of contextual information like N-best lists, and a re-evaluation of the metrics that define success. This section establishes the foundational principles that underpin a robust and reliable LLM-based ASR error correction pipeline. It reframes the problem not as mere text replacement, but as an evidence-based reasoning process, setting the stage for the advanced agentic solutions detailed in subsequent sections.

1.1. Analyzing the ASR Error Landscape
A systematic approach to ASR error correction begins with a precise characterization of the errors themselves. ASR systems, particularly when processing challenging audio, produce a predictable taxonomy of errors that can be broadly categorized as substitutions, deletions, and insertions.

Substitutions occur when the ASR system misinterprets an acoustic signal and replaces the correct word with an incorrect one. These are often phonetic in nature, as exemplified by the classic homophone error where "recognize speech" is transcribed as "wreck a nice beach."

Deletions involve the omission of words that were present in the original audio, often occurring with unstressed or rapidly spoken words.

Insertions are the addition of words not present in the original audio, which can happen when the ASR model misinterprets background noise or disfluencies as speech.

The prevalence and nature of these errors are significantly exacerbated in specific domains, such as telephony audio. This domain presents a confluence of challenges: lower audio fidelity due to compression and network issues, a high degree of spontaneous and informal speech, and the frequent presence of disfluencies (e.g., "um," "uh," hesitations) and overlapping speakers. Consequently, ASR models processing telephony data often exhibit a higher initial Word Error Rate (WER), making effective post-processing not just beneficial but essential for usability.  

A critical observation is that these errors are not random noise. They represent points of ambiguity where the ASR model's acoustic and language models struggled to find a confident interpretation. This ambiguity is the key to understanding the value of supplementary data provided by the ASR system itself. The errors are often the result of phonetic similarity or contextual unlikelihood, providing clues that a more powerful language model can exploit. Recognizing that errors are signals of underlying acoustic or linguistic ambiguity is the first step toward building an intelligent correction system.

1.2. The Role of N-best Lists: From Simple Rescoring to Generative Correction
The N-best list, a standard output from modern beam-search-based ASR decoders, is the single most valuable source of information for post-processing. It contains the top N hypotheses that the ASR model considered most likely for a given audio segment. The utilization of these lists has undergone a significant evolution, mirroring the advancements in language modeling itself.

The traditional approach is Language Model (LM) rescoring. In this paradigm, an external, often larger or more domain-specific, language model is used to re-evaluate the probability of each hypothesis in the N-best list. The hypothesis that receives the highest score from this new LM is then selected as the final output. While effective at resolving some errors, rescoring is fundamentally a selective process; it is constrained to choosing from the pre-existing list and cannot generate a novel transcription that might be more accurate than any of the N candidates.  

The contemporary and more powerful paradigm is Generative Error Correction (GER). In a GER framework, the entire N-best list is provided to an LLM not for selection, but as rich contextual input. The LLM is tasked with  

synthesizing the information across all hypotheses to generate a new, corrected sentence. This represents a fundamental shift from a selective task to a generative one. The rationale behind GER is that the correct transcription is often a composite of correct words and phrases scattered across multiple hypotheses in the N-best list. For instance, the 1-best hypothesis might have one word wrong, while the 3-best hypothesis has that word correct but another word wrong. A GER model can identify the correct fragments from each and combine them into a single, accurate output.

Research consistently demonstrates that using the N-best list as an extended input provides a much richer context and more accurate cues for the LLM, leading to significant performance improvements over methods that only consider the 1-best hypothesis. It effectively exposes the LLM to the ASR model's internal "thought process," revealing the specific points of acoustic confusion.  

This leads to a more nuanced understanding of the N-best list's value. Its primary utility lies not in the quality of its single best hypothesis, but in the disagreement or variance among its top candidates. This disagreement is a powerful, latent signal of the ASR model's uncertainty. When the top few hypotheses are nearly identical, the ASR model is expressing high confidence. Conversely, when the top hypotheses are phonetically similar but semantically divergent (e.g., "nist hotel" vs. "nearest hotel" vs. "next hotel"), it signals a point of high uncertainty where the ASR model is "confused." This observation is corroborated by multiple studies. Some research explicitly proposes using the N-best list for "uncertainty estimation" to identify less reliable transcriptions before attempting correction. Other work has found that LLM-based selection methods provide the greatest benefit on documents with the highest degree of ASR disagreement. Therefore, the variance within the N-best list can be quantified and used as a primary feature to gate the entire correction process. By calculating a divergence score (based on semantic or lexical distance) among the top hypotheses, a system can intelligently identify segments that are prime candidates for LLM review. This transforms the problem from a brute-force approach of "correct every segment" to a targeted strategy of "intelligently identify and correct only the most uncertain segments." This directly addresses the core challenge of unreliability in a fully automated pipeline by focusing cognitive resources where they are most needed and minimizing the risk of altering already correct text.  

1.3. Key Metrics for Success: Beyond Word Error Rate (WER)
For decades, the Word Error Rate (WER) has been the gold standard for measuring ASR performance. It is calculated as the sum of substitutions, deletions, and insertions, normalized by the total number of words in the reference transcript. While invaluable for acoustic model development, WER is an insufficient metric for evaluating the quality of ASR output in the context of downstream LLM-powered applications.  

The primary limitation of WER is that it treats all words as equally important. The substitution of "a" for "the" incurs the same penalty as the substitution of "increase" for "decrease," despite the latter having a catastrophic impact on the semantic meaning of the sentence. To address this, a more context-aware metric is needed. The Answer Error Rate (AER) has been proposed as a more suitable alternative for LLM-based systems. AER evaluates the ASR output based on its ability to support a downstream task, such as question answering. It measures whether the corrected transcript can be used to accurately answer a set of questions derived from the ground truth.  

A crucial finding from this line of research is that a lower WER does not always translate to a lower AER. An LLM-based corrector might make minor changes that slightly increase the WER (e.g., changing a disfluency that was in the ground truth) but significantly improve the clarity and contextual integrity of the text, thereby lowering the AER. Conversely, a system optimized solely for WER might preserve certain errors in less frequent but contextually critical words (e.g., named entities, technical terms) that an LLM-based corrector might fail to fix, leading to a high AER despite a low WER.  

This has profound implications for the design and optimization of an ASR correction agent. The ultimate goal should not be the myopic minimization of WER, but the maximization of the contextual and semantic integrity of the final transcript. The prompting strategies and agentic workflows developed in this report are therefore designed with this higher-level objective in mind. They aim to produce text that is not just lexically similar to a reference, but is factually correct, contextually coherent, and maximally useful for any subsequent language understanding task.

Architecting for Reliability: Multi-Stage Correction and Confidence Scoring
The primary obstacle to deploying a fully automated ASR error correction system is the issue of reliability. An LLM that is applied indiscriminately to a transcript will inevitably introduce new errors, a phenomenon known as over-correction, particularly when the initial transcript quality is already high. The user's report that auto-applied suggestions perform poorly without an "oracle" points directly to this problem. To overcome this, it is necessary to move beyond simple, single-pass prompting and design a system architecture that is fundamentally built for reliability. This involves a multi-stage framework that intelligently decides when to correct and a robust mechanism for verifying the quality of every proposed correction before it is applied.

3.1. The Over-Correction Problem and LLM Hallucinations
LLMs, particularly those fine-tuned for instruction following, exhibit a strong bias for action. When tasked with "correcting" a piece of text, they will often find something to change, even if the original text is perfectly valid. This leads to the well-documented problem of over-correction, where the WER of a transcript can actually increase after post-processing, especially when the initial WER is low. This is because the model may impose a more formal grammatical structure on spontaneous speech or "fix" minor inconsistencies that were present in the original utterance.  

This behavior is a form of "Faithful Hallucination," where the model does not invent new facts but rather fails to adhere perfectly to the constraints of the task. A detailed analysis of these failure modes is essential for designing effective mitigation strategies. The most relevant categories for ASR correction include :  

Redundant Output: The model adds conversational filler to its response, such as "Here is the corrected sentence:..." This complicates programmatic parsing.

Continue Writing: The model corrects the sentence and then continues writing, expanding upon the original text. This is a critical failure mode that adds fabricated content.

Grammar Correction: The model makes a grammatically valid change that unfortunately alters the original meaning or intent of the speaker. For example, changing "it must remember be one or the other" to "It must be remembered to be one or the other" could be a valid correction or a misinterpretation of the speaker's intended phrase.

Instruction Violation: The model fails to follow a specific rule in the prompt, such as a constraint to only use words from the N-best list.

A successful architecture must be designed with the explicit goal of preventing these failure modes. It must operate on the principle of "do no harm," prioritizing the preservation of correct text over the aggressive correction of potential errors.

3.2. A Multi-Stage Correction Framework
To achieve this level of reliability, a single-step correction process is insufficient. A robust, production-grade system should be architected as a multi-stage pipeline that incorporates checks and balances at each step. This approach, inspired by frameworks proposed in the research literature , ensures that the powerful but potentially erratic generative capabilities of the LLM are carefully controlled and verified. The proposed architecture consists of three main stages:  

Stage 1: Error Pre-detection / Uncertainty Estimation
The first and most critical stage operates on the principle that correction should only be attempted when there is strong evidence that an error exists. Instead of passing every segment to the LLM, this stage acts as an intelligent filter or "gate," identifying only those transcriptions that are likely to be incorrect. As established in Section 1.2, the N-best list is the ideal tool for this uncertainty estimation. The system can compute a divergence score based on the lexical or semantic differences between the top N hypotheses. A high divergence score indicates that the ASR model was uncertain, flagging the segment as a high-priority candidate for correction. A low divergence score suggests the ASR model was confident, and the segment can be passed through without LLM intervention, thus avoiding the risk of over-correction entirely. This pre-detection step dramatically improves the overall precision of the system.

Stage 2: Gated Generative Correction
Only the segments that are flagged as uncertain in Stage 1 are passed to the LLM for correction. This "gated" approach ensures that computational resources and the risk of hallucination are focused exclusively on the parts of the transcript that need attention. The specific prompt used in this stage would be selected from the taxonomy presented in Section II, potentially using a tiered approach where simpler prompts are tried first.

Stage 3: Reasoning Process Verification / Confidence Scoring
After the LLM generates a potential correction in Stage 2, this final stage acts as a safety check before the change is committed. The goal of this stage is to evaluate the reliability of the LLM's proposed correction. If the correction is deemed high-confidence, it can be applied automatically. If it is low-confidence, it can be discarded or, in a human-in-the-loop system, flagged for manual review. This verification is performed by calculating a confidence score, a quantitative measure of the LLM's certainty in its own output. This final stage is the system's primary defense against the hallucinations and over-corrections

The Agentic Approach: Integrating Reasoning, Action, and External Tools
The prompting strategies and reliability architectures discussed thus far treat the LLM as a powerful but static text processor. The next level of sophistication involves transforming the LLM into a dynamic, problem-solving agent. An agent, in this context, is a system that combines the language understanding and generation capabilities of an LLM with the ability to use external tools to actively gather information and verify its conclusions. This agentic approach is particularly well-suited to the complex, evidence-based task of ASR error correction and directly leverages the specific tool-using architecture available to the user.

4.1. Introducing the ReAct Framework
The foundational paradigm for building such agents is the ReAct (Reason + Act) framework. ReAct is designed to overcome the limitations of LLMs being confined to their internal knowledge, a weakness that can lead to factual hallucination and error propagation. It does so by enabling the LLM to interact with the external world through tools. The framework operates on a simple but powerful iterative loop:  

Thought: The LLM generates an internal monologue or a "reasoning trace." In this step, it analyzes the current problem, breaks it down into smaller pieces, and formulates a plan of action. This makes the agent's decision-making process transparent and debuggable.

Action: Based on its thought process, the LLM decides to execute an action. This action typically involves calling an external tool or API to gather information that it lacks internally. For example, it might decide to perform a web search, query a database, or use a calculator.

Observation: The LLM receives the output from the tool it called. This new piece of information is the "observation."

Next Thought: The LLM integrates the observation into its understanding of the problem and generates a new thought, refining its plan and deciding on the next step. This loop continues until the agent has gathered enough information and performed sufficient reasoning to arrive at a final answer.

By interleaving reasoning and acting, the ReAct framework transforms the LLM from a passive text generator into an active problem-solver. It can dynamically seek out and use information, validate its hypotheses, and construct a final answer grounded in external evidence.

4.2. A Custom ReAct Workflow for ASR Correction
The true power of the ReAct framework is realized when it is combined with a set of domain-specific tools. The user's agent is equipped with a suite of tools (getSegmentNbest, getSimilarSegments, getWikipediaSummary, getDictionaryDefinition) that are perfectly suited for an ASR correction workflow. By orchestrating these tools within a ReAct loop, the agent can perform a highly reliable, evidence-based investigation for each potential error.  

Consider a scenario where a segment has been flagged by the Stage 1 uncertainty detector with a 1-best hypothesis of "where is the nist hotel". A ReAct agent would tackle this problem as follows:

Initial State: The agent receives the segment, noting its high initial uncertainty score. The 1-best hypothesis is "where is the nist hotel".

Cycle 1:

Thought: The word "nist" appears to be a proper noun or an acronym. It seems unusual in the context of asking for a hotel. My first step is to verify if "nist" is a known entity and if it is plausible in this context. I will use the Wikipedia tool for this.

Action: Call the getWikipediaSummary tool with the query 'NIST'.

Observation: The tool returns the following text: "The National Institute of Standards and Technology (NIST) is a physical sciences laboratory and a non-regulatory agency of the United States Department of Commerce. Its mission is to promote innovation and industrial competitiveness."

Cycle 2:

Thought: The observation confirms that NIST is a real entity, a US government agency. However, it is highly improbable that a person is asking for a hotel located at a government research facility. This increases my suspicion that "nist" is an ASR error. The ASR model likely confused it with a phonetically similar word. My next step is to examine the other hypotheses generated by the ASR to see what those alternatives were. I will use the getSegmentNbest tool.

Action: Call the getSegmentNbest tool for the current segment ID.

Observation: The tool returns the N-best list: [("where is the nist hotel", -0.8), ("where is the nearest hotel", -1.2), ("where is the next hotel", -1.5)].

Cycle 3:

Thought: The N-best list contains the highly plausible alternative "nearest hotel." This is a common type of request and is phonetically close to "nist hotel." The presence of this strong alternative in the ASR's own hypothesis space, combined with the contextual implausibility of the 1-best hypothesis, provides strong evidence for a correction. I am now highly confident that the correct transcription is "where is the nearest hotel." I will propose this correction with a high confidence score.

Action: Call the proposeCorrection tool with the parameters text="where is the nearest hotel" and confidence=0.95.

This workflow demonstrates how the agent systematically builds a case for its correction, using different tools to gather different types of evidence (world knowledge from Wikipedia, acoustic ambiguity from the N-best list) at each step.

4.3. Self-Critique and Refinement: Applying the CRITIC Framework
The ReAct loop can be further enhanced by incorporating a formal step for self-critique and verification. The CRITIC framework formalizes this idea, proposing that an agent should use its tools not only to generate an answer but also to validate and progressively amend its own outputs. This adds a layer of reflective reasoning to the process.  

After the agent in the previous example has proposed the correction "where is the nearest hotel", a CRITIC-inspired step would involve a final check before finalizing the decision.

Critique Cycle:

Thought (Critique): I have proposed changing "nist" to "nearest." This seems correct, but before I finalize, I will perform one last verification. I will check the surrounding transcript to see if there is any other contextual information that supports or contradicts my hypothesis. For example, has the speaker mentioned travel or needing accommodation? I will use the getSimilarSegments tool to search for related concepts.

Action (Critique): Call the getSimilarSegments tool with a semantic query like "hotel location" or "travel plans".

Observation (Critique): The tool returns results from earlier in the transcript, such as the speaker saying, "I've just arrived in the city" and "I need to find a place to stay tonight."

Thought (Final Decision): This contextual information from other parts of the conversation provides strong corroborating evidence that the speaker is looking for accommodation. My proposed correction from "nist" to "nearest" is therefore validated by world knowledge, the ASR hypothesis space, and the broader conversational context. I will now finalize the correction with very high confidence.

This self-critique step, enabled by the agent's tools, makes the correction process even more robust. It ensures that the final decision is not just based on local, segment-level information but is coherent with the entire document.

The suite of tools provided to the agent is not merely a collection of disparate APIs; it functions as a complete "sensory apparatus" that allows the agent to perceive, understand, and verify the world of the transcript. These tools empower the agent to overcome the fundamental limitations of pure text-based reasoning. The getSegmentNbest tool allows it to perceive the ASR model's internal acoustic ambiguity. The getSimilarSegments tool provides it with a local contextual memory, enabling it to check for consistency and coherence. The getWikipediaSummary tool grants it access to a vast repository of external world knowledge for validating entities and concepts. Finally, the getDictionaryDefinition tool provides it with precise lexical knowledge to check for non-words or confirm the meaning of unusual terms.

By combining these tools within a ReAct loop, the agent can construct a multi-faceted, evidence-based case for or against a proposed correction. The process is elevated from a simple pattern-matching task to a methodical investigation. The agent can cross-reference evidence from multiple, independent sources—acoustic, contextual, lexical, and encyclopedic—before arriving at a conclusion. This multi-source verification is what enables a level of reliability that is unattainable with simple prompting alone.

A powerful implication of this agentic workflow is that its output can be more than just the final corrected text. The agent can also output its full reasoning trace—the complete sequence of thoughts, actions, and observations that led to its decision. This trace is an invaluable artifact. For developers, it provides an unprecedented level of transparency, making it possible to debug the agent's "thought process" and understand precisely why it made a particular decision. For end-users or human reviewers, it provides a clear explanation for each change, dramatically increasing trust in the system. When a correction is eventually flagged for human review, the reviewer is presented not just with the "before" and "after" text, but with the entire logical argument the agent constructed. This transforms the review process from a simple proofreading task into a quick validation of the agent's logic, making the human-in-the-loop component exponentially more efficient and insightful.

V. A Practical Prompting Compendium for the ASR Correction Agent
This section consolidates the principles and strategies discussed previously into a practical compendium of production-ready prompts. These prompts are designed to be robust, controllable, and effective, serving as a starting point for implementation. They are divided into two categories: general-purpose prompts that rely only on the N-best list, and more advanced, tool-augmented prompts designed for the agentic framework described in Section IV. Each prompt is accompanied by detailed annotations explaining the rationale behind its structure and components, linking them back to the foundational research.

Prompt 5.1.3: Chain-of-Thought N-best Analysis
This prompt uses the Chain-of-Thought technique to force the model to explicitly reason about the evidence in the N-best list before making a correction. The output reasoning trace can be logged for analysis and debugging.

5.2. Section B: Tool-Augmented Agent Prompts
These prompts are designed for a more advanced agent that uses a model with function-calling capabilities (e.g., via the ReAct framework). They instruct the LLM not just to correct text, but to actively use tools to investigate potential errors.

Prompt 5.2.1: The Master ReAct System Prompt
This is the main system prompt that configures the agent. It defines its persona, its overarching goal, the tools it has access to (with detailed descriptions of their function and parameters), and the structured format it must use for its Thought-Action-Observation loop.

Prompt 5.2.2: The User Prompt for a Single Segment
This is the prompt used to initiate the correction process for a specific, high-uncertainty segment. It provides the necessary data and instructs the agent to begin its investigation.

Prompt 5.2.3: Multi-Segment Consistency Check (CoC-inspired)
This prompt is designed for a specific sub-task within the agent's workflow. It instructs the agent to verify the consistency of a potentially problematic term (e.g., a technical term or a named entity) across the entire document, inspired by the context-aware nature of the Chain of Correction framework.
