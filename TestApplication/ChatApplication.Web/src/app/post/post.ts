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

  public posts: PostItem[] = [];

  public newPostContent: string = '';

  public isSubmitting: boolean = false;


  // =========================
  // Component Initialization
  // =========================

  ngOnInit(): void {
    this.loadPosts();
  }


  // =========================
  // Load Posts
  // =========================

  public loadPosts(): void {

    this.postService
      .getAllPosts()
      .subscribe({

        next: (data: PostItem[]) => {

          this.posts = data;

        },

        error: (err) => {

          console.error(
            'Failed to load posts:',
            err
          );

        }

      });
  }


  // =========================
  // Editor Input
  // =========================

  public onEditorInput(
    event: Event
  ): void {

    const element =
      event.target as HTMLDivElement;

    this.newPostContent =
      element.innerHTML;
  }


  // =========================
  // Execute Editor Command
  // =========================

  public format(command: string): void {

    this.editor.nativeElement.focus();

    document.execCommand(
      command,
      false
    );

    this.updateEditorContent();
  }


  // =========================
  // Add Link
  // =========================

  public addLink(): void {

    this.editor.nativeElement.focus();

    const url = prompt(
      'Enter URL:'
    );

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
  // Remove Formatting
  // =========================

  public clearFormatting(): void {

    this.editor.nativeElement.focus();

    document.execCommand(
      'removeFormat',
      false
    );

    this.updateEditorContent();
  }


  // =========================
  // Update Editor Content
  // =========================

  private updateEditorContent(): void {

    this.newPostContent =
      this.editor.nativeElement.innerHTML;
  }


  // =========================
  // Handle Paste
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
  // Create Post
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


    this.postService
      .createPost(content)
      .subscribe({

        next: (createdPost: PostItem) => {

          // Add new post at the top
          this.posts = [
            createdPost,
            ...this.posts
          ];


          // Clear editor
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

          this.isSubmitting = false;

        }

      });
  }


  // =========================
  // Track Posts
  // =========================

  public trackByPost(
    index: number,
    post: PostItem
  ): string {

    return post.id;
  }
}