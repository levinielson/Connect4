import { JwtBodyDto } from 'server/dto/jwt_body.dto';
import { Server, Socket } from 'socket.io';
import { GatewayAuthGuard } from '../guards/gatewayauth.guard';
import { OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect, WebSocketServer, WebSocketGateway, WsException, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { JwtService } from '../services/jwt.service';
import { UseGuards } from '@nestjs/common';
import { GamesService } from '../services/games.service';
import { Move } from 'server/entities/move.entity';


class TurnPayload {
  gameRoomId: number;
  moveOrder: number;
  moveColumn: number;
}

 @WebSocketGateway()
 @UseGuards(GatewayAuthGuard)
 export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
   @WebSocketServer()
   server: Server;

   constructor(private jwtService: JwtService, 
     //This one is subject to naming
     private gamesService: GamesService) {}

   handleConnection(client: any, ...args: any[]) {
     try {
       // Get the auth token from the client and parse, it it fails it wont connect
       const jwt = client.handshake.auth.token;
       this.jwtService.parseToken(jwt);
       //Add them to the room
       client.join(client.handshake.query.room as unknown as string);
     }
     catch (e) {
       throw new WsException('Invalid token');
     }
   }

   handleDisconnect(client: any) {
     console.log('Client Disconnected');
   }

  @SubscribeMessage('turn')
  public async handleTurn(client: any, payload: TurnPayload) {
    //Store the turn in the database
    let move = new Move();
    move.gameRoomId = client.handshake.query.roomId as number;
    move.moveOrder = payload.moveOrder;
    move.moveColumn = payload.moveColumn;
    await this.gamesService.handleTurn(move);
    const board = await this.gamesService.getMoves(move.gameRoomId);
    //Send the turn to all clients in the room
    this.server.to(`${client.handshake.query.roomId}`).emit('turn', board);
    
   }
 }