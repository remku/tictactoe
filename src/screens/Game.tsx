import { RouteProp, useNavigation } from '@react-navigation/native'
import { NativeStackNavigationProp } from '@react-navigation/native-stack'
import React, { useCallback, useEffect, useState } from 'react'
import {
  BackHandler,
  Image,
  Modal,
  ScrollView,
  StatusBar,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native'
import { Socket } from 'socket.io-client'
import UserCard from '../components/UserCard'
import useAuthContext from '../hooks/useAuthContext'
import useStoreContext from '../hooks/useStoreContext'
import { RootStackParamList } from './Route'
import { SafeAreaView } from 'react-native-safe-area-context'
import X from '../components/X'
import O from '../components/O'
import { TouchableWithoutFeedback } from 'react-native-gesture-handler'
import { Audio } from 'expo-av'

const winnerImage = require('../../assets/images/win.png')
const loserImage = require('../../assets/images/lose.jpg')
const drawImage = require('../../assets/images/draw.png')

type GamePropTypes = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Game'>
  route: RouteProp<RootStackParamList, 'Game'>
}
type Box = {
  index: number
  value: null | 'X' | 'O'
}

const initialGameBoard = [
  {
    index: 1,
    value: null,
  },
  {
    index: 2,
    value: null,
  },
  {
    index: 3,
    value: null,
  },
  {
    index: 4,
    value: null,
  },
  {
    index: 5,
    value: null,
  },
  {
    index: 6,
    value: null,
  },
  {
    index: 7,
    value: null,
  },
  {
    index: 8,
    value: null,
  },
  {
    index: 9,
    value: null,
  },
]

type User = {
  name: string
  photo: string
  isX: boolean
  id: string
}

const Game: React.FC<GamePropTypes> = ({ navigation, route }) => {
  const [currentSocket, setCurrentSocket] = useState<Socket>()
  const { roomId } = route.params
  const storeContext = useStoreContext()
  const { userInfo } = useAuthContext()
  const [gameBoard, setGameBoard] = useState<Box[]>(initialGameBoard)
  const [players, setPlayers] = useState<User[]>()
  const [me, setMe] = useState<User>()
  const [socketIdForCurrentTurn, setSocketIdForCurrentTurn] =
    useState<string>('')
  const [isBoardDisabled, setIsBoardDisabled] = useState<boolean>(true)
  const [isWinnerModalOpen, setIsWinnerModalOpen] = useState<boolean>(false)
  const [isDrawModalOpen, setIsDrawModalOpen] = useState<boolean>(false)
  const [winner, setWinner] = useState<string>('')
  const [isWaitingForPlayerToRestart, setIsWaitingForUserToRestart] =
    useState(false)
  const [playerLeft, setPlayerLeft] = useState(false)
  const [winningIndexes, setWinningIndexes] = useState<number[]>()
  const [winnerAudio, setWinnerAudio] = useState<Audio.Sound>()
  const [loserAudio, setLoserAudio] = useState<Audio.Sound>()
  const [buttonClickAudio, setButtonClickAudio] = useState<Audio.Sound>()

  if (!storeContext) return null

  const { getSocket } = storeContext

  const backHandler = useCallback(() => true, [])

  //   const loadSound = async () => {
  //     console.log('Loading Sound')
  //     try {
  //       const winnerAudioResponse = await Audio.Sound.createAsync(
  //         require('../../assets/audio/winner.mp3')
  //       )
  //       const loserAudioResponse = await Audio.Sound.createAsync(
  //         require('../../assets/audio/loser.mp3')
  //       )
  //       const buttonClickAudioResponse = await Audio.Sound.createAsync(
  //         require('../../assets/audio/buttonClick.mp3')
  //       )
  //       setWinnerAudio(winnerAudioResponse.sound)
  //       setLoserAudio(loserAudioResponse.sound)
  //       setButtonClickAudio(buttonClickAudioResponse.sound)
  //       console.log('sound loaded')
  //     } catch (err) {
  //       console.log(err)
  //     }
  //   }

  const playWinnerSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/audio/winner.mp3')
      )
      sound.playAsync()
    } catch (err) {
      console.log(err)
    }
  }

  const playLoserSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/audio/loser.mp3')
      )
      sound.playAsync()
    } catch (err) {
      console.log(err)
    }
  }

  const playButtonClickSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../assets/audio/buttonClick.mp3')
      )
      sound.playAsync()
    } catch (err) {
      console.log(err)
    }
  }

  useEffect(() => {
    const socket = getSocket()
    setCurrentSocket(socket)

    // load sound
    // loadSound()

    // Join the game
    socket?.emit('joinGame', {
      roomId,
      email: userInfo?.user?.email,
      name: userInfo?.user?.name,
      photo: userInfo?.user?.photo,
    })

    // Restarted game
    socket.on('restarted', () => {
      setGameBoard(initialGameBoard)
      setIsDrawModalOpen(false)
      setIsWinnerModalOpen(false)
      setIsWaitingForUserToRestart(false)
      setWinningIndexes([])
    })

    // Update gameboard
    socket.on('updateBoard', (board) => {
      setGameBoard(board)
    })

    // all player ready
    socket.on('allPlayerReady', (message: string) => {
      setPlayerLeft(false)
    })

    // update UI if new input
    socket.on('receivingDraw', (board: Box[]) => {
      setGameBoard(board)
      playButtonClickSound()
    })

    // When user joined and return all the users
    socket.on('players', (players: User[]) => {
      setPlayers(players)
      const myself = players.find((player) => player.id === socket.id)
      if (!myself) return
      setMe(myself)
    })

    socket.on('playerLeft', (message) => {
      setPlayerLeft(true)
      ToastAndroid.show('Opponent left the room', ToastAndroid.LONG)
    })

    // if there is winner
    socket.on(
      'winner',
      ({ winner, indexes }: { winner: string; indexes: number[] }) => {
        console.log(winner, indexes)
        setWinner(winner)
        if (winner === socket.id) {
          playWinnerSound()
        } else {
          playLoserSound()
        }
        setIsWinnerModalOpen(true)
        setWinningIndexes(indexes)
      }
    )

    // if game ends
    socket.on('endgame', (message: string) => {
      setIsDrawModalOpen(true)
      playWinnerSound()
    })

    socket.on('turn', (id) => {
      setSocketIdForCurrentTurn(id)
      if (id === socket.id) {
        setIsBoardDisabled(false)
      } else {
        setIsBoardDisabled(true)
      }
    })

    const backHandlerSubscription = BackHandler.addEventListener(
      'hardwareBackPress',
      backHandler
    )

    return () => {
      socket.emit('leaveRoom', roomId)
      backHandlerSubscription.remove()
      winnerAudio && winnerAudio.unloadAsync()
      loserAudio && loserAudio.unloadAsync()
      buttonClickAudio && buttonClickAudio.unloadAsync()
    }
  }, [])

  function leaveRoom() {
    navigation.goBack()
  }

  //   TO Draw X or O
  const drawOnBoard = useCallback(
    (index: number) => {
      currentSocket?.emit('drawOnBoard', {
        roomId,
        index,
        value: me?.isX ? 'X' : 'O',
      })
    },
    [me]
  )

  //   send restart request
  const restartGame = () => {
    currentSocket?.emit('restartGame', roomId)
    setIsWaitingForUserToRestart(true)
  }

  return (
    <>
      <View className='bg-[#3B2496] flex-1'>
        <StatusBar backgroundColor={'#3B2496'} barStyle={'light-content'} />
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 15,
            paddingBottom: 60,
          }}
        >
          {/* Room ID */}
          <View className='flex-row justify-between py-5'>
            <Text
              style={{
                fontFamily: 'LilitaOne_400Regular',
                fontSize: 30,
                color: 'white',
              }}
            >
              Room ID: <Text className='text-orange-400'>{roomId}</Text>
            </Text>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className='bg-rose-600 px-3 py-2 rounded-full'
            >
              <Text
                style={{
                  fontFamily: 'LilitaOne_400Regular',
                  color: 'white',
                  fontSize: 16,
                }}
              >
                Leave room
              </Text>
            </TouchableOpacity>
          </View>
          {/* Winner Modal */}
          <Modal
            transparent
            visible={isWinnerModalOpen}
            animationType='slide'
            onRequestClose={() => setIsWinnerModalOpen(false)}
          >
            <View className='flex-1 bg-[#0000007c] relative'>
              <View className='bg-[#6648C4] rounded-xl m-7 p-6 space-y-5 items-center justify-center'>
                <View className='w-[200] h-[200] rounded-full bg-[#a3ff61] flex items-center justify-center'>
                  <Image
                    source={
                      currentSocket?.id === winner ? winnerImage : loserImage
                    }
                    className='rounded-full w-[190] h-[190]'
                  />
                </View>
                <Text
                  style={{
                    fontFamily: 'LilitaOne_400Regular',
                  }}
                  className='uppercase text-4xl text-white'
                >
                  {currentSocket?.id === winner ? 'You win' : 'You lose'}
                </Text>
                <View className='flex flex-row justify-center items-center space-x-5'>
                  {!playerLeft && (
                    <TouchableOpacity onPress={restartGame}>
                      <Text
                        style={{
                          fontFamily: 'LilitaOne_400Regular',
                        }}
                        className='bg-[#2CD57D] uppercase text-white text-lg px-5 py-3 rounded-xl'
                      >
                        {isWaitingForPlayerToRestart
                          ? 'Waiting...'
                          : 'Fight Again'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity onPress={leaveRoom}>
                    <Text
                      style={{
                        fontFamily: 'LilitaOne_400Regular',
                      }}
                      className='bg-[#EB1750] uppercase text-white text-lg px-5 py-3 rounded-xl'
                    >
                      Quit
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Draw Modal */}
          <Modal
            transparent
            visible={isDrawModalOpen}
            animationType='slide'
            onRequestClose={() => setIsDrawModalOpen(false)}
          >
            <View className='flex-1 bg-[#0000007c] relative'>
              <View className='bg-[#6648C4] rounded-xl m-7 p-6 space-y-5 items-center justify-center'>
                <View className='w-[200] h-[200] rounded-full bg-[#a3ff61] flex items-center justify-center'>
                  <Image
                    source={drawImage}
                    className='rounded-full w-[190] h-[190]'
                  />
                </View>
                <Text
                  style={{
                    fontFamily: 'LilitaOne_400Regular',
                  }}
                  className='uppercase text-4xl text-white'
                >
                  Draw !
                </Text>
                <View className='flex flex-row justify-center items-center space-x-5'>
                  {!playerLeft && (
                    <TouchableOpacity onPress={restartGame}>
                      <Text
                        style={{
                          fontFamily: 'LilitaOne_400Regular',
                        }}
                        className='bg-[#2CD57D] uppercase text-white text-lg px-5 py-3 rounded-xl'
                      >
                        {isWaitingForPlayerToRestart
                          ? 'Waiting...'
                          : 'Fight Again'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity onPress={leaveRoom}>
                    <Text
                      style={{
                        fontFamily: 'LilitaOne_400Regular',
                      }}
                      className='bg-[#EB1750] uppercase text-white text-lg px-5 py-3 rounded-xl'
                    >
                      Quit
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* User Cards */}
          <View className='flex-row gap-5 justify-center py-10'>
            {players?.map((player) => {
              return (
                <View key={player.id}>
                  <UserCard
                    currentTurnSocketId={socketIdForCurrentTurn}
                    userSocketId={currentSocket?.id!}
                    {...player}
                  />
                </View>
              )
            })}
          </View>
          {/* GameBoard */}
          <View className='flex flex-row flex-wrap justify-center  bg-[#6648C4] rounded-2xl mt-3'>
            {gameBoard.map((box, idx) => {
              const isWiningIndex = winningIndexes?.includes(idx) || false
              const backgroundColor = isWiningIndex ? 'green' : '#332267'
              return (
                <TouchableOpacity
                  key={idx}
                  onPress={() => {
                    if (!isBoardDisabled) drawOnBoard(box.index)
                  }}
                  style={{
                    backgroundColor,
                  }}
                  className='min-w-[28%] min-h-[115px] m-2 rounded-3xl justify-center items-center'
                >
                  {box.value === 'O' ? (
                    <O winIdx={isWiningIndex} fontSize={80} />
                  ) : (
                    box.value && <X winIdx={isWiningIndex} fontSize={80} />
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        </ScrollView>
      </View>
    </>
  )
}

export default Game
