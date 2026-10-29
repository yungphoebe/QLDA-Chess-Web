import { bestMove } from './xiangqi.js'

onmessage = ({ data: { board, color, depth } }) => postMessage(bestMove(board, color, depth))
