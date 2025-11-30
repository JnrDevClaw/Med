These are the iffernet stages for the completion of my med connect web app one stage must be fully implemented before the next/corresponding satge will be considered. Review my existing codes /structure to know what has been done, what needs to be edited, created or deleted.


Stage 1: 
   Signup -                                                                a.  Store User data on IPFS                                             b.  Store CIDS and map them with the usernames on firestore that way when user data is about to be fetched, the username is used to check for the CIDs that will be used to fetch the user dat form ipfs.                                                                  c. User role are divided into Doctor and Patients.                                                             d. We are using only Firestore as db remove any other existing database implementation.
   e. Update the existing structure to no more ask for the two names - first and last but instead only username.
   Make sure you read the current file structure and the codes to tell you the existing implemtation which we are upgrading.                          
Stage 2:
Create Dashboard:
   Q & A Section (Like Stack Overflow):.
   Upvote/downvote questions.
   Add categoories to question
   Can comment and tag other comments under a question.
   Doctors responses are highlighted.
   When fetching the questions:
   a.  Filter by categories
   b.  Rank/display by no. of upvotes  OR 
   c.  Oldest questions first if no upvotes yet.

Stage 3:
Ask AIs:
   a. Have a refine prompt button beside the text box the user's prompt must be refined first. The prompt will go through oe of the hugging face inference models we will integrate.
   b. Then after that the user will see the refined prompt and can choose to edit the original and refine it again or send the refined prompt. Users can't edit the refined version directly.
   c. Models to integrate: https://huggingface.co/google/medgemma-4b-it
   I'll add more later.

Stage 4:
Video/voice call with doctors
   Auto find doctors online
   Ask to connect 
   Get category of helath issue first before patient can start call
   Prompt user to ensure that the AIs and Q & A section didn't provide the solution.
   Give them links : ask as question and ask ai leads them to the Q & A section or the ask ai doc section

Stage 5: 
Doctor Credentials Verification
   Upload Credentials: certificates/means of identifying yiu are a med practicioner
   Pass credential through ai/apis to verify credentials
   get results
   Change to isVerified = true
   Enable route protection for doctor's routes/priviledges(must have isverified == true).

Stage 6:
Doctors Side Discussion
   Raise up a discusion give topic and issue add category
   Comments
   tag comments
   Only docs can access ths route - isVerifed == true.
