import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
// Explicitly import PostItem ONLY
import { PostService, PostItem } from '../services/post.service';

@Component({
  selector: 'app-post',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="posts-wrapper">
      <div class="posts-container">
        <header class="feed-header">
          <h2>Community Feed</h2>
          <span class="post-count" *ngIf="posts.length">{{ posts.length }} {{ posts.length === 1 ? 'post' : 'posts' }}</span>
        </header>

        <!-- Create Post Form -->
        <div class="create-post-card">
          <textarea
            [(ngModel)]="newPostContent"
            placeholder="What's on your mind?"
            rows="3"
            aria-label="Post content"
          ></textarea>
          <div class="card-actions">
            <button 
              [disabled]="!newPostContent.trim() || isSubmitting" 
              (click)="onCreatePost()"
              class="post-btn"
            >
              {{ isSubmitting ? 'Posting...' : 'Publish Post' }}
            </button>
          </div>
        </div>

        <!-- Feed List -->
        <div class="posts-list">
          @for (post of posts; track post.id) {
            <article class="post-card">
              <div class="post-header">
                <div class="author-info">
                  <div class="avatar-placeholder">
                    {{ post.userName.charAt(0).toUpperCase() }}
                  </div>
                  <span class="author">{{ post.userName }}</span>
                </div>
                <time class="time" [attr.datetime]="post.createdAtUtc">
                  {{ post.createdAtUtc | date:'short' }}
                </time>
              </div>
              <p class="post-content">{{ post.content }}</p>
            </article>
          } @empty {
            <div class="empty-state">
              <p>No posts yet. Be the first to publish one!</p>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    /* Wrapper & Main Layout */
    .posts-wrapper {
      width: 100%;
      min-height: 100vh;
      padding: 12px;
      box-sizing: border-box;
      background-color: #f1f5f9;
      display: flex;
      justify-content: center;
    }

    .posts-container {
      width: 100%;
      max-width: 680px;
      margin: 0 auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    /* Header */
    .feed-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      padding: 0 4px;
    }

    .feed-header h2 {
      margin: 0;
      font-size: clamp(1.25rem, 4vw, 1.5rem);
      color: #0f172a;
      font-weight: 700;
    }

    .post-count {
      font-size: 0.85rem;
      color: #64748b;
      background: #e2e8f0;
      padding: 4px 10px;
      border-radius: 12px;
      font-weight: 500;
    }

    /* Create Post Card */
    .create-post-card {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
      margin-bottom: 20px;
    }

    textarea {
      width: 100%;
      box-sizing: border-box;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #cbd5e1;
      resize: vertical;
      font-family: inherit;
      font-size: 0.95rem;
      color: #1e293b;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      min-height: 80px;
    }

    textarea:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }

    .card-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }

    .post-btn {
      width: 100%;
      padding: 10px 20px;
      background-color: #2563eb;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s ease, transform 0.1s ease;
    }

    .post-btn:hover:not(:disabled) {
      background-color: #1d4ed8;
    }

    .post-btn:active:not(:disabled) {
      transform: scale(0.98);
    }

    .post-btn:disabled {
      background-color: #94a3b8;
      cursor: not-allowed;
    }

    /* Posts Stream */
    .posts-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .post-card {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      word-break: break-word;
    }

    .post-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }

    .author-info {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .avatar-placeholder {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background-color: #dbeafe;
      color: #1e40af;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.95rem;
      flex-shrink: 0;
    }

    .author {
      font-weight: 600;
      color: #0f172a;
      font-size: 0.95rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .time {
      font-size: 0.8rem;
      color: #64748b;
      white-shrink: 0;
    }

    .post-content {
      margin: 0;
      color: #334155;
      font-size: 0.95rem;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    .empty-state {
      text-align: center;
      color: #64748b;
      background: #ffffff;
      padding: 32px 16px;
      border-radius: 12px;
      border: 1px dashed #cbd5e1;
    }

    /* Tablet and Desktop Enhancements */
    @media (min-width: 640px) {
      .posts-wrapper {
        padding: 24px 16px;
      }

      .create-post-card {
        padding: 20px;
      }

      .post-card {
        padding: 20px;
      }

      .post-btn {
        width: auto; /* Inline button on larger screens */
      }

      .avatar-placeholder {
        width: 40px;
        height: 40px;
        font-size: 1rem;
      }
    }
  `]
})
export class Post implements OnInit {
  private postService = inject(PostService);

  // Must use PostItem[] here so TypeScript knows these are data items, not component instances
  public posts: PostItem[] = [];
  public newPostContent: string = '';
  public isSubmitting: boolean = false;

  ngOnInit(): void {
    this.loadPosts();
  }

  public loadPosts(): void {
    this.postService.getAllPosts().subscribe({
      next: (data: PostItem[]) => (this.posts = data),
      error: (err) => console.error('Failed to load posts:', err)
    });
  }

  public onCreatePost(): void {
    if (!this.newPostContent.trim() || this.isSubmitting) return;

    this.isSubmitting = true;
    this.postService.createPost(this.newPostContent).subscribe({
      next: (createdPost: PostItem) => {
        this.posts = [createdPost, ...this.posts];
        this.newPostContent = '';
        this.isSubmitting = false;
      },
      error: (err) => {
        console.error('Failed to create post:', err);
        this.isSubmitting = false;
      }
    });
  }
}