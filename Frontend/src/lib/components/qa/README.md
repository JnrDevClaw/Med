# Q&A Forum Components

This directory contains all the components for the Q&A forum system, implementing a Stack Overflow-style question and answer platform for medical questions.

## Components Overview

### Core Components

- **QuestionCard.svelte** - Displays question cards in the question listing with voting, metadata, and navigation
- **VoteButtons.svelte** - Reusable voting component for questions and answers with upvote/downvote functionality
- **AnswerCard.svelte** - Displays individual answers with voting, acceptance, and comment functionality
- **CommentSection.svelte** - Handles comments and replies for questions and answers with user tagging

### Form Components

- **AnswerForm.svelte** - Form for submitting new answers to questions
- **RichTextEditor.svelte** - Rich text editor with markdown support and formatting toolbar
- **TagInput.svelte** - Tag input component with suggestions and validation
- **QuestionPreview.svelte** - Preview component for question creation form

### Filter Components

- **CategoryFilter.svelte** - Dropdown filter for question categories
- **SortFilter.svelte** - Dropdown for sorting questions by upvotes, date, etc.
- **SearchBar.svelte** - Search input with debounced search functionality
- **Pagination.svelte** - Pagination component for question listings

### Utility Components

- **LoadingSpinner.svelte** - Reusable loading spinner component

## Routes

### Main Routes

- `/qa` - Question listing page with filtering and search
- `/qa/ask` - Question creation form
- `/qa/questions/[id]` - Individual question detail page with answers and comments

## Features Implemented

### Question Management
- ✅ Question listing with pagination
- ✅ Question creation with rich text editor
- ✅ Question categories and tags
- ✅ Question search and filtering
- ✅ Question voting (upvote/downvote)
- ✅ Question preview functionality

### Answer Management
- ✅ Answer creation and display
- ✅ Answer voting system
- ✅ Answer acceptance by question author
- ✅ Answer sorting (by upvotes, date)
- ✅ Doctor answer highlighting

### Comment System
- ✅ Comments on questions and answers
- ✅ Comment replies and threading
- ✅ User tagging in comments (@username)
- ✅ Comment creation and display

### User Experience
- ✅ Responsive design for mobile and desktop
- ✅ Loading states and error handling
- ✅ Doctor badge highlighting
- ✅ Real-time vote updates
- ✅ Form validation and feedback

### Integration
- ✅ Authentication integration
- ✅ API client integration
- ✅ Navigation integration
- ✅ Type safety with TypeScript

## API Integration

The components integrate with the backend Q&A API endpoints:

### Questions API
- `GET /api/questions` - List questions with filtering
- `GET /api/questions/:id` - Get single question
- `POST /api/questions` - Create question
- `PUT /api/questions/:id` - Update question
- `DELETE /api/questions/:id` - Delete question
- `POST /api/questions/:id/vote` - Vote on question
- `GET /api/questions/:id/vote` - Get user's vote
- `GET /api/questions/categories/list` - Get categories

### Answers API
- `GET /api/answers/question/:questionId` - Get answers for question
- `POST /api/answers` - Create answer
- `PUT /api/answers/:id` - Update answer
- `DELETE /api/answers/:id` - Delete answer
- `POST /api/answers/:id/vote` - Vote on answer
- `POST /api/answers/:id/accept` - Accept/unaccept answer

### Comments API
- `GET /api/comments/:parentType/:parentId` - Get comments
- `POST /api/comments` - Create comment
- `PUT /api/comments/:id` - Update comment
- `DELETE /api/comments/:id` - Delete comment
- `GET /api/comments/:id/replies` - Get comment replies
- `GET /api/comments/tagged/:username` - Get tagged comments

## Styling

Components use Tailwind CSS with dark mode support and follow the application's design system:

- Glass morphism effects for cards
- Consistent color scheme with primary/secondary colors
- Responsive breakpoints
- Hover and focus states
- Loading and disabled states
- Doctor highlighting with green accents

## Usage Examples

### Basic Question Listing
```svelte
<script>
  import QuestionCard from '$lib/components/qa/QuestionCard.svelte';
  
  let questions = []; // Load from API
</script>

{#each questions as question}
  <QuestionCard {question} />
{/each}
```

### Vote Buttons
```svelte
<script>
  import VoteButtons from '$lib/components/qa/VoteButtons.svelte';
  
  function handleVote(event) {
    const voteType = event.detail; // 'upvote' or 'downvote'
    // Handle voting logic
  }
</script>

<VoteButtons
  upvotes={10}
  downvotes={2}
  userVote="upvote"
  on:vote={handleVote}
/>
```

### Rich Text Editor
```svelte
<script>
  import RichTextEditor from '$lib/components/qa/RichTextEditor.svelte';
  
  let content = '';
</script>

<RichTextEditor
  bind:value={content}
  placeholder="Enter your question details..."
  maxLength={5000}
/>
```

## Future Enhancements

- [ ] Real-time notifications for comments and answers
- [ ] Question bookmarking/favorites
- [ ] Advanced search with filters
- [ ] Question edit history
- [ ] Reputation system
- [ ] Moderation tools
- [ ] File attachments for questions
- [ ] Question templates by category