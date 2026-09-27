import {
  Component,
  OnInit,
  ViewChild,
  ElementRef,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  PostService,
  PostItem
} from '../services/post.service';

@Component({
  selector: 'app-post',
  standalone: true,

  imports: [
    CommonModule,
    FormsModule
  ],

  templateUrl: './post.html',
  styleUrl: './post.css'
})
export class Post implements OnInit {

  private postService = inject(PostService);

  @ViewChild('editor')
  editor!: ElementRef<HTMLDivElement>;

  // =========================
  // POSTS
  // =========================

  public posts: PostItem[] = [];

  public newPostContent = '';

  public isSubmitting = false;

  public errorMessage = '';

  // ID of the post currently being liked
  public loadingLikePostId: string | null = null;


  // =========================
  // INIT
  // =========================

  ngOnInit(): void {
    this.loadPosts();
  }


  // =========================
  // LOAD POSTS
  // =========================

  public loadPosts(): void {

    this.postService
      .getAllPosts()
      .subscribe({

        next: (data: PostItem[]) => {

          this.posts = data.map(post => {

            return {
              ...post,

              likeCount: post.likeCount || 0,

              commentCount: post.commentCount || 0,

              isLikedByCurrentUser:
                post.isLikedByCurrentUser || false,

              comments: [],

              commentsVisible: false,

              commentsLoaded: false,

              loadingComments: false,

              addingComment: false,

              commentText: ''
            };

          });

        },

        error: (err) => {

          console.error(
            'Failed to load posts:',
            err
          );

          this.errorMessage =
            'Unable to load posts.';

        }

      });
  }


  // =========================
  // EDITOR INPUT
  // =========================

  public onEditorInput(event: Event): void {

    const element =
      event.target as HTMLDivElement;

    this.newPostContent =
      element.innerHTML;
  }


  // =========================
  // FORMAT
  // =========================

  public format(command: string): void {

    if (!this.editor) {
      return;
    }

    this.editor.nativeElement.focus();

    document.execCommand(
      command,
      false
    );

    this.updateEditorContent();
  }


  // =========================
  // ADD LINK
  // =========================

  public addLink(): void {

    if (!this.editor) {
      return;
    }

    this.editor.nativeElement.focus();

    const url = prompt('Enter URL:');

    if (!url) {
      return;
    }

    document.execCommand(
      'createLink',
      false,
      url
    );

    this.updateEditorContent();
  }


  // =========================
  // CLEAR FORMATTING
  // =========================

  public clearFormatting(): void {

    if (!this.editor) {
      return;
    }

    this.editor.nativeElement.focus();

    document.execCommand(
      'removeFormat',
      false
    );

    this.updateEditorContent();
  }


  // =========================
  // UPDATE EDITOR
  // =========================

  private updateEditorContent(): void {

    if (!this.editor) {
      return;
    }

    this.newPostContent =
      this.editor.nativeElement.innerHTML;
  }


  // =========================
  // PASTE
  // =========================

  public onEditorPaste(
    event: ClipboardEvent
  ): void {

    event.preventDefault();

    const text =
      event.clipboardData
        ?.getData('text/plain') || '';

    document.execCommand(
      'insertText',
      false,
      text
    );

    this.updateEditorContent();
  }


  // =========================
  // CREATE POST
  // =========================

  public onCreatePost(): void {

    const content =
      this.newPostContent.trim();

    if (
      !content ||
      content === '<br>' ||
      content === '<div><br></div>' ||
      this.isSubmitting
    ) {
      return;
    }

    this.isSubmitting = true;

    this.errorMessage = '';

    this.postService
      .createPost(content)
      .subscribe({

        next: (createdPost: PostItem) => {

          const post: PostItem = {

            ...createdPost,

            likeCount:
              createdPost.likeCount || 0,

            commentCount:
              createdPost.commentCount || 0,

            isLikedByCurrentUser:
              createdPost.isLikedByCurrentUser || false,

            comments: [],

            commentsVisible: false,

            commentsLoaded: false,

            loadingComments: false,

            addingComment: false,

            commentText: ''

          };

          this.posts = [
            post,
            ...this.posts
          ];

          this.newPostContent = '';

          if (this.editor) {

            this.editor.nativeElement.innerHTML =
              '';

          }

          this.isSubmitting = false;

        },

        error: (err) => {

          console.error(
            'Failed to create post:',
            err
          );

          this.errorMessage =
            'Unable to create post.';

          this.isSubmitting = false;

        }

      });
  }


  // =========================
  // TRACK POSTS
  // =========================

  public trackByPost(
    index: number,
    post: PostItem
  ): string {

    return post.id;
  }


  // =========================
  // LIKE POST
  // =========================

  public toggleLike(
    post: PostItem
  ): void {

    if (
      this.loadingLikePostId === post.id
    ) {
      return;
    }

    this.loadingLikePostId = post.id;

    this.errorMessage = '';

    this.postService
      .toggleLike(post.id)
      .subscribe({

        next: (response) => {

          post.isLikedByCurrentUser =
            response.isLiked;

          post.likeCount =
            response.likeCount;

          this.loadingLikePostId = null;

        },

        error: (error) => {

          console.error(
            'Like error:',
            error
          );

          this.errorMessage =
            'Unable to update like.';

          this.loadingLikePostId = null;

        }

      });
  }


  // =========================
  // TOGGLE COMMENTS
  // =========================

  public toggleComments(
    post: PostItem
  ): void {

    post.commentsVisible =
      !post.commentsVisible;

    if (
      post.commentsVisible &&
      !post.commentsLoaded
    ) {

      this.loadComments(post);

    }
  }


  // =========================
  // LOAD COMMENTS
  // =========================

  public loadComments(
    post: PostItem
  ): void {

    post.loadingComments = true;

    this.postService
      .getComments(post.id)
      .subscribe({

        next: (result) => {

          post.comments =
            result || [];

          post.commentsLoaded =
            true;

          post.loadingComments =
            false;

        },

        error: (error) => {

          console.error(
            'Comments error:',
            error
          );

          post.loadingComments =
            false;

          this.errorMessage =
            'Unable to load comments.';

        }

      });
  }


  // =========================
  // ADD COMMENT
  // =========================

  public addComment(
    post: PostItem
  ): void {

    const content =
      post.commentText?.trim();

    if (
      !content ||
      post.addingComment
    ) {
      return;
    }

    post.addingComment = true;

    this.errorMessage = '';

    this.postService
      .addComment(
        post.id,
        content
      )
      .subscribe({

        next: (comment) => {

          if (!post.comments) {
            post.comments = [];
          }

          post.comments.unshift(
            comment
          );

          post.commentText = '';

          post.commentCount =
            (post.commentCount || 0) + 1;

          post.commentsVisible =
            true;

          post.commentsLoaded =
            true;

          post.addingComment =
            false;

        },

        error: (error) => {

          console.error(
            'Add comment error:',
            error
          );

          this.errorMessage =
            'Unable to add comment.';

          post.addingComment =
            false;

        }

      });
  }


  // =========================
  // POST USER NAME
  // =========================

  public getPostUserName(
    post: PostItem
  ): string {

    return (
      (post as any).userName ||
      (post as any).username ||
      (post as any).authorName ||
      'User'
    );
  }


  // =========================
  // POST INITIAL
  // =========================

  public getPostInitial(
    post: PostItem
  ): string {

    const name =
      this.getPostUserName(post);

    return name
      ? name.charAt(0).toUpperCase()
      : '?';
  }


  // =========================
  // POST DATE
  // =========================

  public getPostDate(
    post: PostItem
  ): string {

    const date =
      (post as any).createdAt;

    return date || '';
  }


  // =========================
  // COMMENT USER NAME
  // =========================

  public getCommentUserName(
    comment: any
  ): string {

    return (
      comment?.userName ||
      comment?.username ||
      comment?.senderUserName ||
      comment?.authorName ||
      'User'
    );
  }


  // =========================
  // COMMENT INITIAL
  // =========================

  public getCommentInitial(
    comment: any
  ): string {

    const name =
      this.getCommentUserName(
        comment
      );

    return name
      ? name.charAt(0).toUpperCase()
      : '?';
  }


  // =========================
  // COMMENT CONTENT
  // =========================

  public getCommentContent(
    comment: any
  ): string {

    return (
      comment?.content ||
      comment?.commentText ||
      comment?.message ||
      ''
    );
  }


  // =========================
  // COMMENT DATE
  // =========================

  public getCommentDate(
    comment: any
  ): string {

    return (
      comment?.createdAt ||
      comment?.commentedAt ||
      ''
    );
  }


  // =========================
  // IMAGE FALLBACK
  // =========================

  public onImageError(
    event: Event
  ): void {

    const image =
      event.target as HTMLImageElement;

    image.src =
      'assets/default-profile.png';
  }

}
