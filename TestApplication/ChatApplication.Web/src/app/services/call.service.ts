import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { BehaviorSubject } from 'rxjs';
import { HUB_URL } from '../app.config';

export type CallType = 'voice' | 'video';

interface IncomingCallPayload {
  senderId: string;
  callerName: string;
  callType?: CallType;
}

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

  private remoteStream: MediaStream | null = null;

  private ringtone: HTMLAudioElement | null = null;

  private pendingIceCandidates: RTCIceCandidateInit[] = [];


  // =========================================================
  // CALL STATE
  // =========================================================

  private activeCallUserId: string | null = null;

  private currentCallType: CallType | null = null;

  private isOutgoingRinging = false;

  private isCallAccepted = false;

  private hasWebRtcConnected = false;

  private isEndingCall = false;


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
        void this.startConnection();
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

    const audioConstraints: MediaTrackConstraints = {
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


    // =======================================================
    // VIDEO
    // =======================================================

    console.log(
      '🎥 Requesting camera + microphone'
    );

    try {

      const stream =
        await navigator.mediaDevices.getUserMedia({
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


    this.currentCallType = callType;

    this.hasWebRtcConnected = false;


    // -------------------------------------------------------
    // Remote stream
    // -------------------------------------------------------

    this.remoteStream = new MediaStream();

    this.remoteStream$.next(
      this.remoteStream
    );


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

    this.peerConnection.onconnectionstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        const state =
          this.peerConnection.connectionState;

        console.log(
          '📡 WebRTC connection state:',
          state,
          {
            ringing:
              this.isOutgoingRinging,

            accepted:
              this.isCallAccepted,

            connected:
              this.hasWebRtcConnected
          }
        );


        // ---------------------------------------------------
        // CONNECTED
        // ---------------------------------------------------

        if (state === 'connected') {

          console.log(
            '✅ WebRTC connected'
          );

          this.hasWebRtcConnected = true;

          this.isCallAccepted = true;

          this.isOutgoingRinging = false;

          this.isCallActive$.next(true);

          return;
        }


        // ---------------------------------------------------
        // DISCONNECTED
        // ---------------------------------------------------

        if (state === 'disconnected') {

          console.warn(
            '⚠️ WebRTC disconnected'
          );

          if (
            this.isOutgoingRinging &&
            !this.isCallAccepted
          ) {

            console.log(
              '⏳ Still ringing. Ignoring WebRTC disconnected state.'
            );

            return;
          }

          if (this.hasWebRtcConnected) {

            console.warn(
              '📴 Connected call disconnected.'
            );

            void this.endCall();
          }

          return;
        }


        // ---------------------------------------------------
        // FAILED
        // ---------------------------------------------------

        if (state === 'failed') {

          console.error(
            '❌ WebRTC failed'
          );

          if (
            this.isOutgoingRinging &&
            !this.isCallAccepted
          ) {

            console.warn(
              '⏳ WebRTC failed while ringing. Keeping call alive.'
            );

            return;
          }

          if (
            this.hasWebRtcConnected ||
            this.isCallAccepted
          ) {

            console.error(
              '❌ Active call WebRTC failed. Ending call.'
            );

            void this.endCall();
          }

          return;
        }


        // ---------------------------------------------------
        // CLOSED
        // ---------------------------------------------------

        if (state === 'closed') {

          console.log(
            '📴 WebRTC closed'
          );
        }
      };


    // =======================================================
    // ICE CONNECTION STATE
    // =======================================================

    this.peerConnection.oniceconnectionstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        const state =
          this.peerConnection.iceConnectionState;

        console.log(
          '🧊 ICE connection state:',
          state
        );

        if (
          state === 'failed' &&
          this.isOutgoingRinging &&
          !this.isCallAccepted
        ) {

          console.warn(
            '⏳ ICE failed while ringing. Ignoring.'
          );

          return;
        }

        if (
          state === 'disconnected' &&
          this.isOutgoingRinging &&
          !this.isCallAccepted
        ) {

          console.warn(
            '⏳ ICE disconnected while ringing. Ignoring.'
          );

          return;
        }
      };


    // =======================================================
    // ICE GATHERING STATE
    // =======================================================

    this.peerConnection.onicegatheringstatechange =
      () => {

        if (!this.peerConnection) {
          return;
        }

        console.log(
          '🧊 ICE gathering:',
          this.peerConnection.iceGatheringState
        );
      };


    // =======================================================
    // LOCAL MEDIA
    // =======================================================

    this.localStream =
      await this.getMediaStream(
        callType
      );

    this.localStream$.next(
      this.localStream
    );


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

        this.peerConnection!.addTrack(
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

          this.remoteStream$.next(
            this.remoteStream
          );
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

          this.remoteStream.addTrack(
            event.track
          );

          console.log(
            '➕ Remote track added:',
            event.track.kind
          );
        }

        this.remoteStream$.next(
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

        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(candidate)
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
        call: IncomingCallPayload
      ) => {

        console.log(
          '📞 Incoming call:',
          call
        );

        if (!call) {
          return;
        }

        const fromUserId =
          call.senderId;

        if (!fromUserId) {

          console.error(
            '❌ Incoming call has no senderId.'
          );

          return;
        }

        const callerName =
          call.callerName ||
          'Unknown user';

        const callType: CallType =
          call.callType === 'voice'
            ? 'voice'
            : 'video';


        this.activeCallUserId =
          fromUserId;

        this.currentCallType =
          callType;

        this.isOutgoingRinging =
          false;

        this.isCallAccepted =
          false;

        this.hasWebRtcConnected =
          false;

        this.incomingCall$.next(
          fromUserId
        );

        this.incomingCallName$.next(
          callerName
        );

        this.incomingCallType$.next(
          callType
        );

        this.playRingtone();
      }
    );


    // =======================================================
    // CALL ACCEPTED
    // =======================================================

    this.connection.on(
      'CallAccepted',
      async (
        fromUserId: string
      ) => {

        console.log(
          '✅ Call accepted:',
          fromUserId
        );

        this.activeCallUserId =
          fromUserId;

        this.isOutgoingRinging =
          false;

        this.isCallAccepted =
          true;

        this.callAccepted$.next(
          fromUserId
        );

        this.stopRingtone();

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
            await this.peerConnection.createOffer();

          await this.peerConnection.setLocalDescription(
            offer
          );


          await this.safeInvoke(
            'SendOffer',
            fromUserId,
            JSON.stringify(offer)
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

          this.isCallActive$.next(false);
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

          this.isOutgoingRinging =
            false;

          this.isCallAccepted =
            true;

          const offer =
            JSON.parse(sdpOffer);

          if (!this.peerConnection) {

            const callType: CallType =
              offer.sdp?.includes('m=video')
                ? 'video'
                : 'voice';

            this.currentCallType =
              callType;

            await this.createPeerConnection(
              fromUserId,
              callType
            );
          }

          await this.peerConnection!
            .setRemoteDescription(
              new RTCSessionDescription(offer)
            );

          console.log(
            '✅ Remote offer applied'
          );

          await this.processPendingIceCandidates();

          const answer =
            await this.peerConnection!.createAnswer();

          await this.peerConnection!
            .setLocalDescription(answer);

          console.log(
            '📨 Sending answer...'
          );

          await this.safeInvoke(
            'SendAnswer',
            fromUserId,
            JSON.stringify(answer)
          );

          console.log(
            '✅ Answer sent'
          );

          this.isCallActive$.next(true);

          this.stopRingtone();

          this.clearIncomingCall();

        } catch (error) {

          console.error(
            '❌ Failed to process offer:',
            error
          );

          this.cleanupWebRTC();

          this.isCallActive$.next(false);
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
            JSON.parse(sdpAnswer);

          await this.peerConnection
            .setRemoteDescription(
              new RTCSessionDescription(answer)
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
            JSON.parse(candidateString);

          if (
            this.peerConnection &&
            this.peerConnection.remoteDescription
          ) {

            await this.peerConnection.addIceCandidate(
              new RTCIceCandidate(candidate)
            );

            console.log(
              '🧊 ICE candidate added'
            );

          } else {

            console.log(
              '🧊 Queueing ICE candidate'
            );

            this.pendingIceCandidates.push(
              candidate
            );
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
      (
        fromUserId: string
      ) => {

        console.log(
          '❌ Call rejected:',
          fromUserId
        );

        this.isOutgoingRinging =
          false;

        this.isCallAccepted =
          false;

        this.callRejected$.next(
          fromUserId
        );

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
      (
        fromUserId: string
      ) => {

        console.log(
          '📴 Call ended:',
          fromUserId
        );

        this.isOutgoingRinging =
          false;

        this.isCallAccepted =
          false;

        this.hasWebRtcConnected =
          false;

        this.callEnded$.next(
          fromUserId
        );

        this.activeCallUserId =
          null;

        this.cleanupWebRTC();

        this.stopRingtone();

        this.clearIncomingCall();
      }
    );
  }


  // =========================================================
  // START CALL
  // =========================================================

  public async startCall(
    targetUserId: string
  ): Promise<void>;

  public async startCall(
    targetUserId: string,
    callType: CallType
  ): Promise<void>;

  public async startCall(
    targetUserId: string,
    callType: CallType = 'video'
  ): Promise<void> {

    return this.startCallInternal(
      targetUserId,
      callType
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
      this.incomingCall$.value ||
      this.isOutgoingRinging
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

    this.isOutgoingRinging =
      true;

    this.isCallAccepted =
      false;

    this.hasWebRtcConnected =
      false;

    this.isEndingCall =
      false;


    try {

      // -----------------------------------------------------
      // Create WebRTC connection
      // -----------------------------------------------------

      await this.createPeerConnection(
        targetUserId,
        callType
      );


      // -----------------------------------------------------
      // Get caller name
      // -----------------------------------------------------

      const callerName =
        this.getCurrentUserName();

      console.log(
        '📞 Calling user:',
        targetUserId
      );

      console.log(
        '👤 Caller name:',
        callerName
      );

      console.log(
        '📱 Call type:',
        callType
      );


      // -----------------------------------------------------
      // Ring receiver
      //
      // IMPORTANT:
      //
      // RingUser requires 3 parameters:
      //
      // 1. targetUserId
      // 2. callerName
      // 3. callType
      // -----------------------------------------------------

      await this.safeInvoke(
        'RingUser',
        targetUserId,
        callerName,
        callType
      );


      console.log(
        '🔔 Receiver is ringing:',
        targetUserId,
        callerName,
        callType
      );


      // -----------------------------------------------------
      // Call is not active until WebRTC connects
      // -----------------------------------------------------

      this.isCallActive$.next(false);

    } catch (error) {

      console.error(
        '❌ Failed to start call:',
        error
      );

      this.isOutgoingRinging =
        false;

      this.isCallAccepted =
        false;

      this.hasWebRtcConnected =
        false;

      this.activeCallUserId =
        null;

      this.currentCallType =
        null;

      this.cleanupWebRTC();

      throw error;
    }
  }


  // =========================================================
  // GET CURRENT USER NAME
  // =========================================================

  private getCurrentUserName(): string {

    const directName =
      localStorage.getItem('userName') ||
      localStorage.getItem('username') ||
      localStorage.getItem('name');

    if (directName?.trim()) {

      return directName.trim();
    }

    const userJson =
      localStorage.getItem('user');

    if (userJson) {

      try {

        const user =
          JSON.parse(userJson);

        if (
          user?.fullName &&
          String(user.fullName).trim()
        ) {

          return String(
            user.fullName
          ).trim();
        }

        const fullName =
          [
            user?.firstName,
            user?.lastName
          ]
            .filter(Boolean)
            .join(' ')
            .trim();

        if (fullName) {
          return fullName;
        }

        if (
          user?.username &&
          String(user.username).trim()
        ) {

          return String(
            user.username
          ).trim();
        }

        if (
          user?.name &&
          String(user.name).trim()
        ) {

          return String(
            user.name
          ).trim();
        }

      } catch (error) {

        console.warn(
          '⚠️ Could not parse localStorage user:',
          error
        );
      }
    }

    return 'Unknown user';
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

    this.isOutgoingRinging =
      false;

    this.isCallAccepted =
      true;

    this.isEndingCall =
      false;

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

      this.isCallAccepted =
        false;

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

    this.isOutgoingRinging =
      false;

    this.isCallAccepted =
      false;

    this.hasWebRtcConnected =
      false;

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

    if (this.isEndingCall) {
      return;
    }

    this.isEndingCall =
      true;

    const targetUserId =
      this.activeCallUserId;

    try {

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

    } finally {

      this.isOutgoingRinging =
        false;

      this.isCallAccepted =
        false;

      this.hasWebRtcConnected =
        false;

      this.activeCallUserId =
        null;

      this.currentCallType =
        null;

      this.cleanupWebRTC();

      this.stopRingtone();

      this.clearIncomingCall();

      this.isEndingCall =
        false;
    }
  }


  // =========================================================
  // MICROPHONE
  // =========================================================

  public toggleMicrophone(): boolean {

    if (!this.localStream) {
      return false;
    }

    const tracks =
      this.localStream.getAudioTracks();

    if (!tracks.length) {
      return false;
    }

    const newEnabled =
      !tracks[0].enabled;

    tracks.forEach(track => {
      track.enabled = newEnabled;
    });

    return newEnabled;
  }


  // =========================================================
  // MICROPHONE STATE
  // =========================================================

  public isMicrophoneEnabled(): boolean {

    if (!this.localStream) {
      return false;
    }

    const track =
      this.localStream.getAudioTracks()[0];

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
      this.localStream.getVideoTracks();

    if (!tracks.length) {
      return false;
    }

    const newEnabled =
      !tracks[0].enabled;

    tracks.forEach(track => {
      track.enabled = newEnabled;
    });

    return newEnabled;
  }


  // =========================================================
  // CAMERA STATE
  // =========================================================

  public isCameraEnabled(): boolean {

    if (!this.localStream) {
      return false;
    }

    const track =
      this.localStream.getVideoTracks()[0];

    return !!track?.enabled;
  }


  // =========================================================
  // CURRENT CALL TYPE
  // =========================================================

  public getCallType():
    CallType | null {

    return this.currentCallType;
  }


  // =========================================================
  // CLEAR INCOMING CALL
  // =========================================================

  private clearIncomingCall(): void {

    this.incomingCall$.next(null);

    this.incomingCallName$.next('');

    this.incomingCallType$.next(null);
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


    if (this.localStream) {

      this.localStream
        .getTracks()
        .forEach(track => {

          try {
            track.stop();
          } catch {
            // Ignore
          }

        });

      this.localStream =
        null;
    }


    if (this.remoteStream) {

      this.remoteStream
        .getTracks()
        .forEach(track => {

          try {
            track.stop();
          } catch {
            // Ignore
          }

        });

      this.remoteStream =
        null;
    }


    this.localStream$.next(null);

    this.remoteStream$.next(null);

    this.pendingIceCandidates = [];


    if (updateCallState) {

      this.isCallActive$.next(false);
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
