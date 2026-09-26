import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { BASE_URL, HUB_URL } from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class CallService {

  // =========================================================
  // SIGNALR
  // =========================================================

  private connection: signalR.HubConnection;
  
  private readonly apiUrl = `${HUB_URL}/chatHub`;

  // =========================================================
  // WEBRTC
  // =========================================================

  private peerConnection: RTCPeerConnection | null = null;

  private localStream: MediaStream | null = null;

  private ringtone: HTMLAudioElement | null = null;

  private pendingIceCandidates: RTCIceCandidateInit[] = [];

  // =========================================================
  // ACTIVE CALL USER
  // =========================================================

  /**
   * The user on the other side of the current call.
   *
   * This is important because incomingCall$ becomes null
   * after the call is accepted.
   */
  private activeCallUserId: string | null = null;

  // =========================================================
  // OBSERVABLES
  // =========================================================

  /**
   * Caller user ID.
   *
   * Initial value is null because no call exists.
   */
  public incomingCall$ =
    new BehaviorSubject<string | null>(null);

  /**
   * Caller full name.
   *
   * Example:
   *
   * Rahul Tripathi
   */
  public incomingCallName$ =
    new BehaviorSubject<string>('');

  /**
   * Emits when receiver accepts the call.
   */
  public callAccepted$ =
    new BehaviorSubject<string | null>(null);

  /**
   * Emits when receiver rejects the call.
   */
  public callRejected$ =
    new BehaviorSubject<string | null>(null);

  /**
   * Emits when remote user ends the call.
   */
  public callEnded$ =
    new BehaviorSubject<string | null>(null);

  public typingUserId$ =
  new BehaviorSubject<string | null>(null);

public isTyping$ =
  new BehaviorSubject<boolean>(false);


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor() {

    this.connection =
      new signalR.HubConnectionBuilder()

        .withUrl(
          this.apiUrl,
          {
            accessTokenFactory: () =>
              localStorage.getItem('token') || ''
          }
        )

        .withAutomaticReconnect()

        .build();


    // Register handlers BEFORE starting connection
    this.registerSignalRHandlers();


    // Start SignalR
    this.startConnection();
  }


  // =========================================================
  // START SIGNALR
  // =========================================================

  private async startConnection(): Promise<void> {

    try {

      if (
        this.connection.state ===
        signalR.HubConnectionState.Disconnected
      ) {

        await this.connection.start();

        console.log(
          '✅ Call SignalR connected'
        );

      }

    } catch (error) {

      console.error(
        '❌ Call SignalR connection failed:',
        error
      );

      setTimeout(() => {
        this.startConnection();
      }, 5000);
    }
  }


  // =========================================================
  // SAFE SIGNALR INVOKE
  // =========================================================

  private async safeInvoke(
    method: string,
    ...args: any[]
  ): Promise<any> {

    if (
      this.connection.state !==
      signalR.HubConnectionState.Connected
    ) {

      console.log(
        'SignalR not connected. Starting connection...'
      );

      await this.startConnection();
    }

    if (
      this.connection.state !==
      signalR.HubConnectionState.Connected
    ) {

      throw new Error(
        'Call SignalR connection is not ready.'
      );
    }

    return this.connection.invoke(
      method,
      ...args
    );
  }


  // =========================================================
  // GET MEDIA
  // =========================================================

  private async getMediaStream(): Promise<MediaStream> {

    const audioConstraints: MediaTrackConstraints = {

      echoCancellation: true,

      noiseSuppression: true,

      autoGainControl: true

    };


    try {

      const stream =
        await navigator.mediaDevices.getUserMedia({

          audio: audioConstraints,

          video: {
            width: 1280,
            height: 720
          }

        });


      stream
        .getAudioTracks()
        .forEach(track => {

          track.enabled = true;

        });


      return stream;

    } catch (error) {

      console.warn(
        'Video permission failed. Falling back to audio:',
        error
      );


      const stream =
        await navigator.mediaDevices.getUserMedia({

          audio: audioConstraints,

          video: false

        });


      stream
        .getAudioTracks()
        .forEach(track => {

          track.enabled = true;

        });


      return stream;
    }
  }


  // =========================================================
  // CREATE PEER CONNECTION
  // =========================================================

  private async createPeerConnection(
    targetUserId: string
  ): Promise<void> {

    console.log(
      'Creating peer connection for:',
      targetUserId
    );


    this.peerConnection =
      new RTCPeerConnection({

        iceServers: [

          {
            urls:
              'stun:stun.l.google.com:19302'
          },

          {
            urls:
              'stun:stun1.l.google.com:19302'
          },

          {
            urls:
              'stun:stun2.l.google.com:19302'
          },

          {
            urls:
              'stun:stun3.l.google.com:19302'
          },

          {
            urls:
              'stun:stun4.l.google.com:19302'
          }

        ]

      });


    // =======================================================
    // LOCAL MEDIA
    // =======================================================

    this.localStream =
      await this.getMediaStream();


    this.localStream
      .getTracks()
      .forEach(track => {

        this.peerConnection!
          .addTrack(
            track,
            this.localStream!
          );

      });


    this.attachLocalVideo();


    // =======================================================
    // REMOTE TRACK
    // =======================================================

    this.peerConnection.ontrack =
      async (event) => {

        console.log(
          '🎥 Remote track received'
        );


        const remoteVideo =
          document.getElementById(
            'remoteVideo'
          ) as HTMLVideoElement;


        if (!remoteVideo) {

          console.warn(
            'remoteVideo element not found'
          );

          return;
        }


        let remoteStream: MediaStream;


        if (
          event.streams &&
          event.streams.length > 0
        ) {

          remoteStream =
            event.streams[0];

        } else {

          remoteStream =
            new MediaStream([
              event.track
            ]);

        }


        remoteVideo.srcObject =
          remoteStream;

        remoteVideo.muted = false;

        remoteVideo.volume = 1;


        try {

          await remoteVideo.play();

        } catch (error) {

          console.warn(
            'Remote video autoplay blocked:',
            error
          );

        }

      };


    // =======================================================
    // ICE CANDIDATE
    // =======================================================

    this.peerConnection.onicecandidate =
      async (event) => {

        if (!event.candidate) {
          return;
        }


        try {

          await this.safeInvoke(
            'SendIceCandidate',
            targetUserId,
            JSON.stringify(
              event.candidate
            )
          );

        } catch (error) {

          console.error(
            'Failed to send ICE candidate:',
            error
          );

        }

      };
  }


  // =========================================================
  // ATTACH LOCAL VIDEO
  // =========================================================

  private attachLocalVideo(): void {

    const localVideo =
      document.getElementById(
        'localVideo'
      ) as HTMLVideoElement;


    if (!localVideo) {

      console.warn(
        'localVideo element not found yet.'
      );

      return;
    }


    if (!this.localStream) {
      return;
    }


    localVideo.srcObject =
      this.localStream;

    localVideo.muted = true;


    localVideo.play()
      .catch(error => {

        console.warn(
          'Local video play failed:',
          error
        );

      });
  }


  // =========================================================
  // PROCESS QUEUED ICE
  // =========================================================

  private async processPendingIceCandidates(): Promise<void> {

    if (
      !this.peerConnection ||
      !this.peerConnection.remoteDescription
    ) {

      return;
    }


    while (
      this.pendingIceCandidates.length > 0
    ) {

      const candidate =
        this.pendingIceCandidates.shift();


      if (!candidate) {
        continue;
      }


      try {

        await this.peerConnection
          .addIceCandidate(
            new RTCIceCandidate(
              candidate
            )
          );

      } catch (error) {

        console.error(
          'Failed to process queued ICE candidate:',
          error
        );

      }
    }
  }


  // =========================================================
  // SIGNALR HANDLERS
  // =========================================================

  private registerSignalRHandlers(): void {

    // =======================================================
    // INCOMING CALL
    // =======================================================

    this.connection.on(
      'IncomingCall',
      (
        fromUserId: string,
        firstName: string,
        lastName: string
      ) => {

        console.log(
          '================================'
        );

        console.log(
          '📞 IncomingCall received'
        );

        console.log(
          'Caller ID:',
          fromUserId
        );

        console.log(
          'First Name:',
          firstName
        );

        console.log(
          'Last Name:',
          lastName
        );

        console.log(
          '================================'
        );


        if (!fromUserId) {

          console.error(
            '❌ IncomingCall received without caller ID'
          );

          return;
        }


        const callerName =
          `${firstName || ''} ${lastName || ''}`
            .trim();


        // Store caller ID
        this.incomingCall$
          .next(fromUserId);


        // Store caller full name
        this.incomingCallName$
          .next(
            callerName ||
            'Unknown user'
          );


        // Remember active call user
        this.activeCallUserId =
          fromUserId;


        // Start ringtone
        this.playRingtone();

      }
    );


    // =======================================================
    // RECEIVE OFFER
    // =======================================================

    this.connection.on(
      'ReceiveOffer',
      async (
        fromUserId: string,
        sdpOffer: string
      ) => {

        console.log(
          '📨 ReceiveOffer from:',
          fromUserId
        );


        try {

          this.activeCallUserId =
            fromUserId;


          // Create peer connection
          await this.createPeerConnection(
            fromUserId
          );


          // Set remote description
          await this.peerConnection!
            .setRemoteDescription(
              new RTCSessionDescription(
                JSON.parse(sdpOffer)
              )
            );


          // Process queued ICE
          await this.processPendingIceCandidates();


          // Create answer
          const answer =
            await this.peerConnection!
              .createAnswer();


          // Set local description
          await this.peerConnection!
            .setLocalDescription(
              answer
            );


          // Send answer
          await this.safeInvoke(
            'SendAnswer',
            fromUserId,
            JSON.stringify(answer)
          );


          this.stopRingtone();

        } catch (error) {

          console.error(
            '❌ Failed to process offer:',
            error
          );

        }
      }
    );


    // =======================================================
    // RECEIVE ANSWER
    // =======================================================

    this.connection.on(
      'ReceiveAnswer',
      async (
        fromUserId: string,
        sdpAnswer: string
      ) => {

        console.log(
          '📨 ReceiveAnswer from:',
          fromUserId
        );


        try {

          if (!this.peerConnection) {
            return;
          }


          await this.peerConnection
            .setRemoteDescription(
              new RTCSessionDescription(
                JSON.parse(sdpAnswer)
              )
            );


          await this.processPendingIceCandidates();

        } catch (error) {

          console.error(
            '❌ Failed to process answer:',
            error
          );

        }
      }
    );


    // =======================================================
    // RECEIVE ICE
    // =======================================================

    this.connection.on(
      'ReceiveIceCandidate',
      async (
        fromUserId: string,
        candidateString: string
      ) => {

        console.log(
          '🧊 ICE candidate from:',
          fromUserId
        );


        if (!candidateString) {
          return;
        }


        try {

          const candidate:
            RTCIceCandidateInit =
              JSON.parse(
                candidateString
              );


          if (
            this.peerConnection &&
            this.peerConnection.remoteDescription
          ) {

            await this.peerConnection
              .addIceCandidate(
                new RTCIceCandidate(
                  candidate
                )
              );

          } else {

            this.pendingIceCandidates
              .push(candidate);

          }

        } catch (error) {

          console.error(
            '❌ Failed to process ICE candidate:',
            error
          );

        }
      }
    );


    // =======================================================
    // CALL ACCEPTED
    // =======================================================

    this.connection.on(
      'CallAccepted',
      (
        fromUserId: string
      ) => {

        console.log(
          '✅ Call accepted by:',
          fromUserId
        );


        this.activeCallUserId =
          fromUserId;


        this.callAccepted$
          .next(fromUserId);


        this.stopRingtone();

      }
    );


    // =======================================================
    // CALL REJECTED
    // =======================================================

    this.connection.on(
      'CallRejected',
      (
        fromUserId: string
      ) => {

        console.log(
          '❌ Call rejected by:',
          fromUserId
        );


        this.callRejected$
          .next(fromUserId);


        this.activeCallUserId =
          null;


        this.cleanupWebRTC();

        this.stopRingtone();

      }
    );


    // =======================================================
    // CALL ENDED
    // =======================================================

    this.connection.on(
      'CallEnded',
      (
        fromUserId: string
      ) => {

        console.log(
          '📴 Call ended by:',
          fromUserId
        );


        this.callEnded$
          .next(fromUserId);


        this.activeCallUserId =
          null;


        this.cleanupWebRTC();

        this.stopRingtone();

      }
    );
  }


  // =========================================================
  // START CALL
  // =========================================================

  public async startCall(
    targetUserId: string
  ): Promise<void> {

    if (!targetUserId) {

      throw new Error(
        'Target user ID is required.'
      );
    }


    console.log(
      '📞 Starting call to:',
      targetUserId
    );


    this.activeCallUserId =
      targetUserId;


    // Create WebRTC connection
    await this.createPeerConnection(
      targetUserId
    );


    // Ring receiver
    await this.safeInvoke(
      'RingUser',
      targetUserId
    );


    // Create offer
    const offer =
      await this.peerConnection!
        .createOffer({

          offerToReceiveAudio: true,

          offerToReceiveVideo: true

        });


    // Set local description
    await this.peerConnection!
      .setLocalDescription(
        offer
      );


    // Send offer
    await this.safeInvoke(
      'SendOffer',
      targetUserId,
      JSON.stringify(offer)
    );
  }


  // =========================================================
  // ACCEPT CALL
  // =========================================================

  public async acceptCall(
    fromUserId: string
  ): Promise<void> {

    if (!fromUserId) {

      throw new Error(
        'Caller user ID is required.'
      );
    }


    console.log(
      '📞 Accepting call from:',
      fromUserId
    );


    this.activeCallUserId =
      fromUserId;


    await this.safeInvoke(
      'AcceptCall',
      fromUserId
    );


    this.stopRingtone();


    this.incomingCall$
      .next(null);

    this.incomingCallName$
      .next('');
  }


  // =========================================================
  // REJECT CALL
  // =========================================================

  public async rejectCall(
    fromUserId: string
  ): Promise<void> {

    if (!fromUserId) {
      return;
    }


    console.log(
      '❌ Rejecting call from:',
      fromUserId
    );


    await this.safeInvoke(
      'RejectCall',
      fromUserId
    );


    this.activeCallUserId =
      null;


    this.stopRingtone();


    this.incomingCall$
      .next(null);

    this.incomingCallName$
      .next('');


    this.cleanupWebRTC();
  }


  // =========================================================
  // END CALL
  // =========================================================

  public async endCall(
    notifyServer: boolean = true
  ): Promise<void> {

    const targetUserId =
      this.activeCallUserId;


    console.log(
      '📴 Ending call. Target:',
      targetUserId
    );


    // Notify remote user FIRST
    if (
      notifyServer &&
      targetUserId
    ) {

      try {

        await this.safeInvoke(
          'EndCall',
          targetUserId
        );

      } catch (error) {

        console.error(
          'Failed to notify remote user:',
          error
        );

      }
    }


    // Clear active user
    this.activeCallUserId =
      null;


    // Cleanup WebRTC
    this.cleanupWebRTC();


    // Stop ringtone
    this.stopRingtone();


    // Clear incoming state
    this.incomingCall$
      .next(null);

    this.incomingCallName$
      .next('');
  }


  // =========================================================
  // CLEANUP WEBRTC
  // =========================================================

  private cleanupWebRTC(): void {

    if (this.peerConnection) {

      this.peerConnection.ontrack = null;

      this.peerConnection.onicecandidate = null;

      this.peerConnection.close();

      this.peerConnection =
        null;
    }


    if (this.localStream) {

      this.localStream
        .getTracks()
        .forEach(track => {

          track.stop();

        });

      this.localStream =
        null;
    }


    const localVideo =
      document.getElementById(
        'localVideo'
      ) as HTMLVideoElement;


    if (localVideo) {

      localVideo.srcObject =
        null;

    }


    const remoteVideo =
      document.getElementById(
        'remoteVideo'
      ) as HTMLVideoElement;


    if (remoteVideo) {

      remoteVideo.srcObject =
        null;

    }


    this.pendingIceCandidates = [];
  }


  // =========================================================
  // RINGTONE
  // =========================================================

  private playRingtone(): void {

    this.stopRingtone();


    this.ringtone =
      new Audio(
        'assets/ringtone.mp3'
      );


    this.ringtone.loop =
      true;


    this.ringtone
      .play()
      .catch(error => {

        console.warn(
          'Ringtone playback error:',
          error
        );

      });
  }


  // =========================================================
  // STOP RINGTONE
  // =========================================================

  private stopRingtone(): void {

    if (!this.ringtone) {
      return;
    }


    this.ringtone.pause();

    this.ringtone.currentTime = 0;

    this.ringtone = null;
  }
}