import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { HUB_URL } from '../app.config';

export type CallType = 'voice' | 'video';

@Injectable({
  providedIn: 'root'
})
export class CallService {

  // =========================================================
  // SIGNALR
  // =========================================================

  private connection: signalR.HubConnection;

  private readonly apiUrl =
    `${HUB_URL}/chatHub`;


  // =========================================================
  // WEBRTC
  // =========================================================

  private peerConnection:
    RTCPeerConnection | null = null;

  private localStream:
    MediaStream | null = null;

  private remoteStream:
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

  private currentCallType:
    CallType | null = null;


  // =========================================================
  // OBSERVABLES
  // =========================================================

  public incomingCall$ =
    new BehaviorSubject<string | null>(null);

  public incomingCallName$ =
    new BehaviorSubject<string>('');

  public incomingCallType$ =
    new BehaviorSubject<CallType | null>(null);

  public isCallActive$ =
    new BehaviorSubject<boolean>(false);

  public callAccepted$ =
    new BehaviorSubject<string | null>(null);

  public callRejected$ =
    new BehaviorSubject<string | null>(null);

  public callEnded$ =
    new BehaviorSubject<string | null>(null);


  // =========================================================
  // MEDIA
  // =========================================================

  public localStream$ =
    new BehaviorSubject<MediaStream | null>(null);

  public remoteStream$ =
    new BehaviorSubject<MediaStream | null>(null);


  // =========================================================
  // TYPING
  // =========================================================

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

    this.registerSignalRHandlers();

    this.startConnection();
  }


  // =========================================================
  // SIGNALR CONNECTION
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

      await this.startConnection();
    }

    if (
      this.connection.state !==
      signalR.HubConnectionState.Connected
    ) {

      throw new Error(
        'SignalR connection is not ready.'
      );
    }

    return this.connection.invoke(
      method,
      ...args
    );
  }


  // =========================================================
  // GET MEDIA STREAM
  // =========================================================

  private async getMediaStream(
    callType: CallType
  ): Promise<MediaStream> {

    const audioConstraints:
      MediaTrackConstraints = {

      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };


    // =======================================================
    // VOICE
    // =======================================================

    if (callType === 'voice') {

      console.log(
        '🎤 Requesting microphone'
      );

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


    // =======================================================
    // VIDEO
    // =======================================================

    console.log(
      '🎥 Requesting camera + microphone'
    );

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

      return stream;

    } catch (error) {

      console.error(
        '❌ Camera/microphone permission failed:',
        error
      );

      throw error;
    }
  }


  // =========================================================
  // CREATE PEER CONNECTION
  // =========================================================

  private async createPeerConnection(
    targetUserId: string,
    callType: CallType
  ): Promise<void> {

    console.log(
      '🔗 Creating peer connection:',
      targetUserId,
      callType
    );


    // -------------------------------------------------------
    // Cleanup previous connection
    // -------------------------------------------------------

    if (this.peerConnection) {

      this.cleanupWebRTC(false);
    }


    this.currentCallType =
      callType;


    // -------------------------------------------------------
    // Remote stream
    // -------------------------------------------------------

    this.remoteStream =
      new MediaStream();

    this.remoteStream$
      .next(this.remoteStream);


    // -------------------------------------------------------
    // Peer connection
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
          }

        ]

      });


    // =======================================================
    // CONNECTION STATE
    // =======================================================

    this.peerConnection
      .onconnectionstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        const state =
          this.peerConnection
            .connectionState;

        console.log(
          '📡 WebRTC connection state:',
          state
        );


        if (state === 'connected') {

          console.log(
            '✅ WebRTC connected'
          );

          this.isCallActive$
            .next(true);
        }


        if (state === 'disconnected') {

          console.warn(
            '⚠️ WebRTC disconnected'
          );
        }


        if (state === 'failed') {

          console.error(
            '❌ WebRTC failed'
          );

          this.endCall();
        }


        if (state === 'closed') {

          console.log(
            '📴 WebRTC closed'
          );
        }
      };


    // =======================================================
    // ICE CONNECTION STATE
    // =======================================================

    this.peerConnection
      .oniceconnectionstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        console.log(
          '🧊 ICE connection state:',
          this.peerConnection
            .iceConnectionState
        );
      };


    // =======================================================
    // ICE GATHERING STATE
    // =======================================================

    this.peerConnection
      .onicegatheringstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        console.log(
          '🧊 ICE gathering:',
          this.peerConnection
            .iceGatheringState
        );
      };


    // =======================================================
    // LOCAL MEDIA
    // =======================================================

    this.localStream =
      await this.getMediaStream(
        callType
      );

    this.localStream$
      .next(this.localStream);


    // -------------------------------------------------------
    // Add local tracks
    // -------------------------------------------------------

    this.localStream
      .getTracks()
      .forEach(track => {

        console.log(
          '➕ Adding local track:',
          track.kind
        );

        this.peerConnection!
          .addTrack(
            track,
            this.localStream!
          );
      });


    // =======================================================
    // REMOTE TRACK
    // =======================================================

    this.peerConnection.ontrack =
      (event: RTCTrackEvent) => {

        console.log(
          '🎥/🎤 Remote track:',
          event.track.kind
        );


        if (!this.remoteStream) {

          this.remoteStream =
            new MediaStream();

          this.remoteStream$
            .next(this.remoteStream);
        }


        const exists =
          this.remoteStream
            .getTracks()
            .some(
              track =>
                track.id ===
                event.track.id
            );


        if (!exists) {

          this.remoteStream
            .addTrack(
              event.track
            );

          console.log(
            '➕ Remote track added:',
            event.track.kind
          );
        }


        this.remoteStream$
          .next(
            this.remoteStream
          );
      };


    // =======================================================
    // ICE CANDIDATE
    // =======================================================

    this.peerConnection.onicecandidate =
      async (event) => {

        if (!event.candidate) {

          console.log(
            '🧊 ICE gathering completed'
          );

          return;
        }


        console.log(
          '🧊 Local ICE candidate generated'
        );


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
            '❌ Failed to send ICE candidate:',
            error
          );
        }
      };
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


    if (
      this.pendingIceCandidates.length === 0
    ) {

      return;
    }


    console.log(
      '🧊 Processing queued ICE candidates:',
      this.pendingIceCandidates.length
    );


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
          '❌ Failed queued ICE:',
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
        lastName: string,
        callType?: CallType
      ) => {

        console.log(
          '📞 Incoming call:',
          fromUserId,
          callType
        );


        if (!fromUserId) {
          return;
        }


        const callerName =
          `${firstName || ''} ${lastName || ''}`
            .trim() ||
          'Unknown user';


        this.activeCallUserId =
          fromUserId;


        this.incomingCall$
          .next(fromUserId);


        this.incomingCallName$
          .next(callerName);


        this.incomingCallType$
          .next(
            callType === 'voice'
              ? 'voice'
              : 'video'
          );


        this.playRingtone();
      }
    );


    // =======================================================
    // CALL ACCEPTED
    // =======================================================

    this.connection.on(
      'CallAccepted',

      async (fromUserId: string) => {

        console.log(
          '✅ Call accepted:',
          fromUserId
        );


        this.activeCallUserId =
          fromUserId;


        this.callAccepted$
          .next(fromUserId);


        this.stopRingtone();


        // ---------------------------------------------------
        // IMPORTANT:
        // Create/send offer ONLY after acceptance.
        // ---------------------------------------------------

        try {

          if (!this.peerConnection) {

            console.error(
              '❌ No peer connection when call was accepted.'
            );

            return;
          }


          console.log(
            '📨 Creating offer after acceptance...'
          );


          const offer =
            await this.peerConnection
              .createOffer();


          await this.peerConnection
            .setLocalDescription(
              offer
            );


          await this.safeInvoke(
            'SendOffer',

            fromUserId,

            JSON.stringify(
              offer
            )
          );


          console.log(
            '📨 Offer sent after acceptance'
          );

        } catch (error) {

          console.error(
            '❌ Failed to create/send offer:',
            error
          );

          this.cleanupWebRTC();

          this.isCallActive$
            .next(false);
        }
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
          '📨 Offer received:',
          fromUserId
        );


        try {

          this.activeCallUserId =
            fromUserId;


          const offer =
            JSON.parse(
              sdpOffer
            );


          // --------------------------------------------------
          // Determine voice/video
          // --------------------------------------------------

          const callType:
            CallType =
            offer.sdp?.includes(
              'm=video'
            )
              ? 'video'
              : 'voice';


          this.currentCallType =
            callType;


          console.log(
            '📞 Incoming media type:',
            callType
          );


          // --------------------------------------------------
          // Create receiver peer connection
          // --------------------------------------------------

          if (!this.peerConnection) {

            await this.createPeerConnection(
              fromUserId,
              callType
            );
          }


          // --------------------------------------------------
          // Set remote offer
          // --------------------------------------------------

          await this.peerConnection!
            .setRemoteDescription(
              new RTCSessionDescription(
                offer
              )
            );


          console.log(
            '✅ Remote offer applied'
          );


          // --------------------------------------------------
          // Process ICE received before offer
          // --------------------------------------------------

          await this.processPendingIceCandidates();


          // --------------------------------------------------
          // Create answer
          // --------------------------------------------------

          const answer =
            await this.peerConnection!
              .createAnswer();


          await this.peerConnection!
            .setLocalDescription(
              answer
            );


          console.log(
            '📨 Sending answer...'
          );


          // --------------------------------------------------
          // Send answer
          // --------------------------------------------------

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


          this.isCallActive$
            .next(true);


          this.stopRingtone();

          this.clearIncomingCall();

        } catch (error) {

          console.error(
            '❌ Failed to process offer:',
            error
          );

          this.cleanupWebRTC();

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
          '📨 Answer received:',
          fromUserId
        );


        try {

          if (!this.peerConnection) {

            console.warn(
              '⚠️ No peer connection for answer.'
            );

            return;
          }


          const answer =
            JSON.parse(
              sdpAnswer
            );


          await this.peerConnection
            .setRemoteDescription(
              new RTCSessionDescription(
                answer
              )
            );


          console.log(
            '✅ Remote answer applied'
          );


          await this.processPendingIceCandidates();

        } catch (error) {

          console.error(
            '❌ Answer processing failed:',
            error
          );
        }
      }
    );


    // =======================================================
    // RECEIVE ICE CANDIDATE
    // =======================================================

    this.connection.on(
      'ReceiveIceCandidate',

      async (
        fromUserId: string,
        candidateString: string
      ) => {

        console.log(
          '🧊 ICE candidate received:',
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


          // --------------------------------------------------
          // Remote description already exists
          // --------------------------------------------------

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
              '🧊 ICE candidate added'
            );

          } else {

            // ------------------------------------------------
            // Offer/answer has not arrived yet.
            // Queue candidate.
            // ------------------------------------------------

            console.log(
              '🧊 Queueing ICE candidate'
            );

            this.pendingIceCandidates
              .push(candidate);
          }

        } catch (error) {

          console.error(
            '❌ ICE processing failed:',
            error
          );
        }
      }
    );


    // =======================================================
    // CALL REJECTED
    // =======================================================

    this.connection.on(
      'CallRejected',

      (fromUserId: string) => {

        console.log(
          '❌ Call rejected:',
          fromUserId
        );


        this.callRejected$
          .next(fromUserId);


        this.activeCallUserId =
          null;


        this.cleanupWebRTC();

        this.stopRingtone();

        this.clearIncomingCall();
      }
    );


    // =======================================================
    // CALL ENDED
    // =======================================================

    this.connection.on(
      'CallEnded',

      (fromUserId: string) => {

        console.log(
          '📴 Call ended:',
          fromUserId
        );


        this.callEnded$
          .next(fromUserId);


        this.activeCallUserId =
          null;


        this.cleanupWebRTC();

        this.stopRingtone();

        this.clearIncomingCall();
      }
    );
  }


  // =========================================================
  // START VIDEO CALL
  // =========================================================

  public async startCall(
    targetUserId: string
  ): Promise<void> {

    return this.startCallInternal(
      targetUserId,
      'video'
    );
  }


  // =========================================================
  // START VOICE CALL
  // =========================================================

  public async startVoiceCall(
    targetUserId: string
  ): Promise<void> {

    return this.startCallInternal(
      targetUserId,
      'voice'
    );
  }


  // =========================================================
  // START CALL INTERNAL
  // =========================================================

  private async startCallInternal(
    targetUserId: string,
    callType: CallType
  ): Promise<void> {

    if (!targetUserId) {

      throw new Error(
        'Target user ID is required.'
      );
    }


    if (
      this.isCallActive$.value ||
      this.peerConnection ||
      this.incomingCall$.value
    ) {

      console.warn(
        'A call is already in progress.'
      );

      return;
    }


    this.activeCallUserId =
      targetUserId;

    this.currentCallType =
      callType;


    try {

      // -----------------------------------------------------
      // Create local WebRTC connection/media.
      //
      // We prepare the connection while the other user
      // is ringing, but DO NOT create/send the offer yet.
      // -----------------------------------------------------

      await this.createPeerConnection(
        targetUserId,
        callType
      );


      // -----------------------------------------------------
      // Ring receiver
      // -----------------------------------------------------

      try {

        await this.safeInvoke(
          'RingUser',
          targetUserId,
          callType
        );

      } catch (error) {

        console.warn(
          'RingUser with call type failed. Retrying old signature.',
          error
        );


        await this.safeInvoke(
          'RingUser',
          targetUserId
        );
      }


      console.log(
        '🔔 Receiver is ringing'
      );


      // -----------------------------------------------------
      // IMPORTANT:
      //
      // Do NOT create the offer here.
      //
      // CallAccepted handler creates and sends the offer.
      // -----------------------------------------------------

      this.isCallActive$
        .next(false);

    } catch (error) {

      console.error(
        '❌ Failed to start call:',
        error
      );


      this.activeCallUserId =
        null;


      this.currentCallType =
        null;


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
        'Caller ID is required.'
      );
    }


    this.activeCallUserId =
      fromUserId;


    try {

      console.log(
        '📞 Accepting call:',
        fromUserId
      );


      await this.safeInvoke(
        'AcceptCall',
        fromUserId
      );


      this.stopRingtone();

      this.clearIncomingCall();


      console.log(
        '✅ Call accepted'
      );

    } catch (error) {

      console.error(
        '❌ Failed to accept call:',
        error
      );

      throw error;
    }
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


    try {

      await this.safeInvoke(
        'RejectCall',
        fromUserId
      );

    } catch (error) {

      console.error(
        '❌ Reject notification failed:',
        error
      );
    }


    this.activeCallUserId =
      null;

    this.currentCallType =
      null;


    this.cleanupWebRTC();

    this.stopRingtone();

    this.clearIncomingCall();
  }


  // =========================================================
  // END CALL
  // =========================================================

  public async endCall(
    notifyServer: boolean = true
  ): Promise<void> {

    const targetUserId =
      this.activeCallUserId;


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
          '❌ Failed to notify call end:',
          error
        );
      }
    }


    this.activeCallUserId =
      null;

    this.currentCallType =
      null;


    this.cleanupWebRTC();

    this.stopRingtone();

    this.clearIncomingCall();
  }


  // =========================================================
  // MICROPHONE
  // =========================================================

  public toggleMicrophone(): boolean {

    if (!this.localStream) {
      return false;
    }


    const tracks =
      this.localStream
        .getAudioTracks();


    if (!tracks.length) {
      return false;
    }


    const newEnabled =
      !tracks[0].enabled;


    tracks.forEach(track => {

      track.enabled =
        newEnabled;

    });


    return newEnabled;
  }


  public isMicrophoneEnabled(): boolean {

    if (!this.localStream) {
      return false;
    }


    const track =
      this.localStream
        .getAudioTracks()[0];


    return !!track?.enabled;
  }


  // =========================================================
  // CAMERA
  // =========================================================

  public toggleCamera(): boolean {

    if (!this.localStream) {
      return false;
    }


    const tracks =
      this.localStream
        .getVideoTracks();


    if (!tracks.length) {
      return false;
    }


    const newEnabled =
      !tracks[0].enabled;


    tracks.forEach(track => {

      track.enabled =
        newEnabled;

    });


    return newEnabled;
  }


  public isCameraEnabled(): boolean {

    if (!this.localStream) {
      return false;
    }


    const track =
      this.localStream
        .getVideoTracks()[0];


    return !!track?.enabled;
  }


  // =========================================================
  // CURRENT CALL TYPE
  // =========================================================

  public getCallType(): CallType | null {

    return this.currentCallType;
  }


  // =========================================================
  // CLEAR INCOMING CALL
  // =========================================================

  private clearIncomingCall(): void {

    this.incomingCall$
      .next(null);

    this.incomingCallName$
      .next('');

    this.incomingCallType$
      .next(null);
  }


  // =========================================================
  // CLEANUP WEBRTC
  // =========================================================

  private cleanupWebRTC(
    updateCallState: boolean = true
  ): void {

    console.log(
      '🧹 Cleaning WebRTC'
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

      this.peerConnection.onicegatheringstatechange =
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
    // Local tracks
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
    // Remote tracks
    // -------------------------------------------------------

    if (this.remoteStream) {

      this.remoteStream
        .getTracks()
        .forEach(track => {

          track.stop();

        });


      this.remoteStream =
        null;
    }


    // -------------------------------------------------------
    // Subjects
    // -------------------------------------------------------

    this.localStream$
      .next(null);

    this.remoteStream$
      .next(null);


    // -------------------------------------------------------
    // ICE
    // -------------------------------------------------------

    this.pendingIceCandidates =
      [];


    // -------------------------------------------------------
    // UI
    // -------------------------------------------------------

    if (updateCallState) {

      this.isCallActive$
        .next(false);
    }
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
          '⚠️ Ringtone playback blocked:',
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
