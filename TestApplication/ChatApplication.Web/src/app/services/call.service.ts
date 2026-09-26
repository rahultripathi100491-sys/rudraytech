import { Injectable } from '@angular/core';

import * as signalR
  from '@microsoft/signalr';

import { BehaviorSubject } from 'rxjs';

import {
  HUB_URL
} from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class CallService {

  // =========================================================
  // SIGNALR
  // =========================================================

  private connection:
    signalR.HubConnection;

  private readonly apiUrl =
    `${HUB_URL}/chatHub`;


  // =========================================================
  // WEBRTC
  // =========================================================

  private peerConnection:
    RTCPeerConnection | null = null;

  private localStream:
    MediaStream | null = null;

  private ringtone:
    HTMLAudioElement | null = null;

  private pendingIceCandidates:
    RTCIceCandidateInit[] = [];


  // =========================================================
  // ACTIVE CALL
  // =========================================================

  private activeCallUserId:
    string | null = null;


  // =========================================================
  // OBSERVABLES
  // =========================================================

  /**
   * Incoming caller ID
   */
  public incomingCall$ =
    new BehaviorSubject<string | null>(null);


  /**
   * Incoming caller name
   */
  public incomingCallName$ =
    new BehaviorSubject<string>('');


  /**
   * True while video call UI is active
   */
  public isCallActive$ =
    new BehaviorSubject<boolean>(false);


  /**
   * Call accepted
   */
  public callAccepted$ =
    new BehaviorSubject<string | null>(null);


  /**
   * Call rejected
   */
  public callRejected$ =
    new BehaviorSubject<string | null>(null);


  /**
   * Call ended
   */
  public callEnded$ =
    new BehaviorSubject<string | null>(null);


  /**
   * Typing state
   */
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


    // Register handlers BEFORE connection
    this.registerSignalRHandlers();


    // Start SignalR
    this.startConnection();
  }


  // =========================================================
  // START CONNECTION
  // =========================================================

  private async startConnection():
    Promise<void> {

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
  // SAFE INVOKE
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

  private async getMediaStream():
    Promise<MediaStream> {

    const audioConstraints:
      MediaTrackConstraints = {

        echoCancellation: true,

        noiseSuppression: true,

        autoGainControl: true
      };


    // -------------------------------------------------------
    // VIDEO + AUDIO
    // -------------------------------------------------------

    try {

      const stream =
        await navigator.mediaDevices
          .getUserMedia({

            audio: audioConstraints,

            video: {
              width: {
                ideal: 1280
              },

              height: {
                ideal: 720
              },

              facingMode: 'user'
            }

          });


      stream
        .getAudioTracks()
        .forEach(track => {

          track.enabled = true;

        });


      stream
        .getVideoTracks()
        .forEach(track => {

          track.enabled = true;

        });


      console.log(
        '🎥 Camera + microphone enabled'
      );


      return stream;

    } catch (error) {

      console.warn(
        'Video permission failed. Falling back to audio:',
        error
      );


      // -----------------------------------------------------
      // AUDIO ONLY
      // -----------------------------------------------------

      const stream =
        await navigator.mediaDevices
          .getUserMedia({

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


    // If old connection exists
    if (this.peerConnection) {

      this.cleanupWebRTC();

    }


    // -------------------------------------------------------
    // CREATE RTCPeerConnection
    // -------------------------------------------------------

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


    // -------------------------------------------------------
    // CONNECTION STATE
    // -------------------------------------------------------

    this.peerConnection.onconnectionstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        console.log(
          'WebRTC connection state:',
          this.peerConnection.connectionState
        );


        if (
          this.peerConnection.connectionState ===
          'connected'
        ) {

          console.log(
            '✅ WebRTC connected'
          );

          this.isCallActive$.next(true);
        }


        if (
          this.peerConnection.connectionState ===
          'failed'
        ) {

          console.error(
            '❌ WebRTC connection failed'
          );

        }


        if (
          this.peerConnection.connectionState ===
          'disconnected'
        ) {

          console.warn(
            '⚠️ WebRTC disconnected'
          );

        }
      };


    // -------------------------------------------------------
    // ICE CONNECTION STATE
    // -------------------------------------------------------

    this.peerConnection.oniceconnectionstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        console.log(
          'ICE state:',
          this.peerConnection.iceConnectionState
        );

      };


    // =======================================================
    // LOCAL MEDIA
    // =======================================================

    this.localStream =
      await this.getMediaStream();


    // Add every local track
    this.localStream
      .getTracks()
      .forEach(track => {

        console.log(
          'Adding local track:',
          track.kind
        );


        this.peerConnection!
          .addTrack(
            track,
            this.localStream!
          );

      });


    // Attach own video
    this.attachLocalVideo();


    // =======================================================
    // REMOTE TRACK
    // =======================================================

    this.peerConnection.ontrack =
      async (event) => {

        console.log(
          '🎥 Remote track received:',
          event.track.kind
        );


        const remoteVideo =
          document.getElementById(
            'remoteVideo'
          ) as HTMLVideoElement | null;


        if (!remoteVideo) {

          console.warn(
            '❌ remoteVideo element not found'
          );

          return;
        }


        let remoteStream:
          MediaStream;


        if (
          event.streams &&
          event.streams.length > 0
        ) {

          remoteStream =
            event.streams[0];

        } else {

          remoteStream =
            remoteVideo.srcObject as
            MediaStream ||
            new MediaStream();

          remoteStream.addTrack(
            event.track
          );
        }


        remoteVideo.srcObject =
          remoteStream;


        remoteVideo.autoplay = true;

        remoteVideo.playsInline = true;

        remoteVideo.muted = false;

        remoteVideo.volume = 1;


        try {

          await remoteVideo.play();

          console.log(
            '▶️ Remote video playing'
          );

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
      ) as HTMLVideoElement | null;


    if (!localVideo) {

      console.warn(
        '❌ localVideo element not found'
      );

      return;
    }


    if (!this.localStream) {
      return;
    }


    localVideo.srcObject =
      this.localStream;

    localVideo.muted = true;

    localVideo.autoplay = true;

    localVideo.playsInline = true;


    localVideo.play()
      .then(() => {

        console.log(
          '▶️ Local video playing'
        );

      })
      .catch(error => {

        console.warn(
          'Local video play failed:',
          error
        );

      });
  }


  // =========================================================
  // PROCESS PENDING ICE
  // =========================================================

  private async processPendingIceCandidates():
    Promise<void> {

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
            '❌ IncomingCall without caller ID'
          );

          return;
        }


        const callerName =
          `${firstName || ''} ${lastName || ''}`
            .trim();


        // Caller ID
        this.incomingCall$
          .next(fromUserId);


        // Caller name
        this.incomingCallName$
          .next(
            callerName ||
            'Unknown user'
          );


        // Remember caller
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


          // Make video UI visible
          this.isCallActive$
            .next(true);


          // Create peer connection
          await this.createPeerConnection(
            fromUserId
          );


          // Set remote description
          await this.peerConnection!
            .setRemoteDescription(
              new RTCSessionDescription(
                JSON.parse(
                  sdpOffer
                )
              )
            );


          console.log(
            '✅ Remote offer set'
          );


          // Process queued ICE
          await this.processPendingIceCandidates();


          // Create answer
          const answer =
            await this.peerConnection!
              .createAnswer({

                offerToReceiveAudio: true,

                offerToReceiveVideo: true

              });


          // Set local description
          await this.peerConnection!
            .setLocalDescription(
              answer
            );


          console.log(
            '✅ Answer created'
          );


          // Send answer
          await this.safeInvoke(
            'SendAnswer',

            fromUserId,

            JSON.stringify(
              answer
            )
          );


          console.log(
            '✅ Answer sent'
          );


          this.stopRingtone();


        } catch (error) {

          console.error(
            '❌ Failed to process offer:',
            error
          );


          this.isCallActive$
            .next(false);

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

            console.warn(
              'No peer connection for answer'
            );

            return;
          }


          await this.peerConnection
            .setRemoteDescription(
              new RTCSessionDescription(
                JSON.parse(
                  sdpAnswer
                )
              )
            );


          console.log(
            '✅ Remote answer set'
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


            console.log(
              '✅ ICE candidate added'
            );

          } else {

            console.log(
              '⏳ Queuing ICE candidate'
            );


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


        this.isCallActive$
          .next(true);


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


    try {

      // -----------------------------------------------------
      // Create WebRTC
      // -----------------------------------------------------

      await this.createPeerConnection(
        targetUserId
      );


      // -----------------------------------------------------
      // Show video UI
      // -----------------------------------------------------

      this.isCallActive$
        .next(true);


      // -----------------------------------------------------
      // Notify receiver
      // -----------------------------------------------------

      await this.safeInvoke(
        'RingUser',
        targetUserId
      );


      console.log(
        '🔔 Receiver ringing'
      );


      // -----------------------------------------------------
      // Create offer
      // -----------------------------------------------------

      const offer =
        await this.peerConnection!
          .createOffer({

            offerToReceiveAudio: true,

            offerToReceiveVideo: true

          });


      // -----------------------------------------------------
      // Set local description
      // -----------------------------------------------------

      await this.peerConnection!
        .setLocalDescription(
          offer
        );


      console.log(
        '✅ Local offer created'
      );


      // -----------------------------------------------------
      // Send offer
      // -----------------------------------------------------

      await this.safeInvoke(
        'SendOffer',

        targetUserId,

        JSON.stringify(
          offer
        )
      );


      console.log(
        '📨 Offer sent'
      );


    } catch (error) {

      console.error(
        '❌ Failed to start call:',
        error
      );


      this.activeCallUserId =
        null;


      this.isCallActive$
        .next(false);


      this.cleanupWebRTC();


      throw error;
    }
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


    // Show video area
    this.isCallActive$
      .next(true);


    // Tell server
    await this.safeInvoke(
      'AcceptCall',
      fromUserId
    );


    this.stopRingtone();


    // Remove popup
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


    try {

      await this.safeInvoke(
        'RejectCall',
        fromUserId
      );

    } catch (error) {

      console.error(
        'Failed to reject call:',
        error
      );

    }


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


    // -------------------------------------------------------
    // Notify remote first
    // -------------------------------------------------------

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


    // -------------------------------------------------------
    // Clear active user
    // -------------------------------------------------------

    this.activeCallUserId =
      null;


    // -------------------------------------------------------
    // Cleanup WebRTC
    // -------------------------------------------------------

    this.cleanupWebRTC();


    // -------------------------------------------------------
    // Stop ringtone
    // -------------------------------------------------------

    this.stopRingtone();


    // -------------------------------------------------------
    // Clear incoming state
    // -------------------------------------------------------

    this.incomingCall$
      .next(null);

    this.incomingCallName$
      .next('');
  }


  // =========================================================
  // CLEANUP WEBRTC
  // =========================================================

  private cleanupWebRTC(): void {

    console.log(
      '🧹 Cleaning up WebRTC'
    );


    // -------------------------------------------------------
    // Peer connection
    // -------------------------------------------------------

    if (this.peerConnection) {

      this.peerConnection.ontrack =
        null;

      this.peerConnection.onicecandidate =
        null;

      this.peerConnection.onconnectionstatechange =
        null;

      this.peerConnection.oniceconnectionstatechange =
        null;


      try {

        this.peerConnection.close();

      } catch {
        // Ignore
      }


      this.peerConnection =
        null;
    }


    // -------------------------------------------------------
    // Local media
    // -------------------------------------------------------

    if (this.localStream) {

      this.localStream
        .getTracks()
        .forEach(track => {

          track.stop();

        });


      this.localStream =
        null;
    }


    // -------------------------------------------------------
    // Local video
    // -------------------------------------------------------

    const localVideo =
      document.getElementById(
        'localVideo'
      ) as HTMLVideoElement | null;


    if (localVideo) {

      localVideo.pause();

      localVideo.srcObject =
        null;
    }


    // -------------------------------------------------------
    // Remote video
    // -------------------------------------------------------

    const remoteVideo =
      document.getElementById(
        'remoteVideo'
      ) as HTMLVideoElement | null;


    if (remoteVideo) {

      remoteVideo.pause();

      remoteVideo.srcObject =
        null;
    }


    // -------------------------------------------------------
    // Clear ICE
    // -------------------------------------------------------

    this.pendingIceCandidates = [];


    // -------------------------------------------------------
    // Hide call UI
    // -------------------------------------------------------

    this.isCallActive$
      .next(false);
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

    this.ringtone.currentTime =
      0;

    this.ringtone =
      null;
  }
}