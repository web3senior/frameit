import { useState, useRef, useEffect } from 'react'
import toast, { Toaster } from 'react-hot-toast'
import { useUpProvider } from '../contexts/UpProvider'
import { PinataSDK } from 'pinata'
import ABI from '../abi/test.json'
import Frame from './../assets/frame.png'
import Logo from '/logo.svg'
import Web3 from 'web3'
import styles from './Home.module.scss'
import { useNavigate } from 'react-router'

const pinata = new PinataSDK({
  pinataJwt: import.meta.env.VITE_PINATA_API_KEY,
  pinataGateway: 'example-gateway.mypinata.cloud',
})

function Home() {
  const [totalSupply, setTotalSupply] = useState(0)
  const [collection, setCollection] = useState()
  const [token, setToken] = useState()

  const [freeMintCount, setFreeMintCount] = useState(0)

  const canvasRef = useRef()
  const asideRef = useRef()
  const coverRef = useRef()
  const fileRef = useRef()
  const navigate = useNavigate()

  const auth = useUpProvider()

  const web3Readonly = new Web3(import.meta.env.VITE_LUKSO_PROVIDER)
  const _ = web3Readonly.utils
  const contractReadonly = new web3Readonly.eth.Contract(ABI, import.meta.env.VITE_CONTRACT)

  const download = (url) => {
    //const htmlStr = SVG.current.outerHTML
    // const blob = new Blob([htmlStr], { type: 'image/svg+xml' })
    // const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
    //  return
    //   const a = document.createElement('a')
    // a.setAttribute('download')

    //   a.setAttribute('href', url)
    //   a.style.display = 'none'
    //   document.body.appendChild(a)
    //   a.click()
    //   a.remove()
    // URL.revokeObjectURL(url)
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const rAsset = async (cid) => {
    const assetBuffer = await fetch(`${cid}`, {
      mode: 'cors',
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    }).then(async (response) => {
      return response.arrayBuffer().then((buffer) => new Uint8Array(buffer))
    })

    return assetBuffer
  }

  const upload = async () => {
    const htmlStr = document.querySelector(`.${styles['board']} svg`).outerHTML
    const blob = new Blob([htmlStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)

    try {
      const t = toast.loading(`Uploading`)
      const file = new File([blob], 'test.svg', { type: blob.type })
      const upload = await pinata.upload.file(file)
      // console.log(upload)
      toast.dismiss(t)
      return [upload.IpfsHash, url]
    } catch (error) {
      console.log(error)
    }
  }

  const getTotalSupply = async () => await contractReadonly.methods.totalSupply().call()
  const getSwipePool = async (tokenId) => await contractReadonly.methods.swipePool(tokenId).call()

  const fetchData = async (dataURL) => {
    let requestOptions = {
      method: 'GET',
      redirect: 'follow',
    }
    const response = await fetch(`${dataURL}`, requestOptions)
    if (!response.ok) throw new Response('Failed to get data', { status: 500 })
    return response.json()
  }

  const getDataForTokenId = async (tokenId) => await contractReadonly.methods.getDataForTokenId(`${tokenId}`, '0x9afb95cacc9f95858ec44aa8c3b685511002e30ae54415823f406128b85b238e').call()

  const handleTokenDetail = async (tokenId) => {
    setSwipeModal(false)
    setTokenDetailModal(true)

    // Read connect wallet profile
    if (auth.walletConnected) {
      handleSearchProfile(auth.accounts[0]).then((profile) => {
        // console.log(profile)
        setProfile(profile)
      })

      // Read how many swipes left
      getSwipePool(tokenId, auth.accounts[0]).then((res) => {
        // console.log(res)
        setSwipeCount(_.toNumber(res))
      })
    }

    getDataForTokenId(tokenId).then((data) => {
      data = _.hexToUtf8(data)
      data = data.search(`data:application/json;`) > -1 ? data.slice(data.search(`data:application/json;`), data.length) : `${import.meta.env.VITE_IPFS_GATEWAY}` + data.slice(data.search(`ipfs://`), data.length).replace(`ipfs://`, '')

      fetchData(data).then((dataContent) => {
        // console.log(dataContent)
        dataContent.tokenId = tokenId
        console.log(dataContent)
        setTokenDetail(dataContent)

        // add the image to canvas
        var can = document.getElementById('canvas')
        var ctx = can.getContext('2d')

        var img = new Image()
        img.onload = function () {
          ctx.drawImage(img, 0, 0, can.width, can.height)
        }
        img.crossOrigin = `anonymous`
        img.src = `${import.meta.env.VITE_IPFS_GATEWAY}${dataContent.LSP4Metadata.images[0][0].url.replace('ipfs://', '').replace('://', '')}`
      })
    })
  }

  const downloadCanvas = function (tokenId) {
    const link = document.createElement('a')
    link.download = `${tokenId}.png`
    link.href = canvasRef.current.toDataURL()
    link.click()
    link.remove()
  }

  const getAllCollection = async (addr) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
    search_profiles(args: {search: "${addr}"}) {
    id
    lsp5ReceivedAssets(where: {asset: {isLSP7: {_eq: false}}}) {
      id
      asset_id
      asset {
        id
        isCollection
        isLSP7
        name
        lsp4TokenName
        lsp4TokenSymbol
        lsp4TokenType
        src
        tokens {
          id
          asset_id
          baseAsset_id
          name
          tokenId
          src
          holders {
            profile {
              fullName
              id
            }
          }
        }
        images {
          src
        }
      }
    }
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    return data
  }
  const getAllTokens = async (collection) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
  Asset(where: {id: {_eq: "${collection}"}}) {
    id
    lsp4TokenName
    lsp4TokenSymbol
    isCollection
    tokens {
      baseAsset_id
      images {
        src
        token {
          tokenId
        }
      }
      holders {
        profile_id
      }
    }
    owner_id
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    return data
  }

  const getTokenInfo = async (collection, tokenId) => {
    var myHeaders = new Headers()
    myHeaders.append('Content-Type', `application/json`)
    myHeaders.append('Accept', `application/json`)

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify({
        query: `query MyQuery {
  Asset(where: {id: {_eq: "${collection}"}}) {
    id
    lsp4TokenName
    lsp4TokenSymbol
    isCollection
    tokens(
      where: {tokenId: {_eq: "${tokenId}"}}
    ) {
      baseAsset_id
      images {
        src
        token {
          tokenId
        }
      }
    }
  }
}`,
      }),
    }
    const response = await fetch(`${import.meta.env.VITE_PUBLIC_API_ENDPOINT}`, requestOptions)
    if (!response.ok) {
      throw new Response('Failed to ', { status: 500 })
    }
    const data = await response.json()
    return data
  }

  const showTokens = async (collection) => {
    const t = toast.loading(`Reading tokens`)
    setToken('')

    getAllTokens(collection).then((res) => {
      console.log(res.data.Asset[0].tokens.filter((item) => item.holders[0].profile_id == auth.accounts[0]))
      setToken(res.data.Asset[0].tokens.filter((item) => item.holders[0].profile_id == auth.accounts[0]))
      toast.dismiss(t)
    })
  }

  const addToCanvas = (path) => {
    const t = toast.loading(`Loading image`)
    // add the image to canvas
    const can = canvasRef.current
    const ctx = can.getContext('2d')

    const img = new Image()
    img.onload = function () {
      ctx.drawImage(img, 155, 53, 467, 467)
      toast.dismiss(t)
    }
    img.crossOrigin = `anonymous`
    img.src = path
  }

  const chooseLocalFile = (e) => {
    fileRef.current.click()
  }

  const hideAside = () => {
    console.log(`hide`)
    asideRef.current.classList.add(`${styles['hide']}`)
    coverRef.current.classList.add(`animate__fadeOut`)
  }

  const showAside = () => {
    const t = toast.loading(`Reading collections`)
    setCollection('')
    setToken('')

    getAllCollection(auth.accounts[0]).then((res) => {
      console.log(res)
      setCollection(res)
      toast.dismiss(t)
    })
    asideRef.current.classList.remove(`${styles['hide']}`)
    coverRef.current.classList.add(`animate__fadeOut`)
  }

  useEffect(() => {
    console.clear()

    fileRef.current.onchange = (e) => {
      const file = e.target.files[0]
      // add the image to canvas
      const can = canvasRef.current
      const ctx = can.getContext('2d')

      const img = new Image()
      img.onload = function () {
        ctx.drawImage(img, 155, 53, 467, 467)
      }
      img.crossOrigin = `anonymous`
      img.src = URL.createObjectURL(file)
    }

    // add the image to canvas
    const can = canvasRef.current
    const ctx = can.getContext('2d')

    const img = new Image()
    img.onload = function () {
      ctx.drawImage(img, 0, 0, can.width, can.height)
    }
    img.crossOrigin = `anonymous`
    img.src = Frame
    //img.src = `https://api.universalprofile.cloud/image/bafybeifkvtmwqzjfpqjkd5jetjh7u7b6ixs36fwjvydne3s6sceduwn3g4?method=keccak256(bytes)&data=0xb6641e9cead9ce820a9fb1c3fa71fdfd4a45db431e1190b90fac71414dadb263&width=260`
  }, [])

  return (
    <>
      <div className={`${styles.page}`}>
        <Toaster />

        <aside ref={asideRef} className={`${styles.aside} ${styles.hide}`}>
          <div ref={coverRef} className={`animate__animated ${styles.aside__cover}`} onClick={(e) => hideAside()}></div>
          <div className={styles.aside__wrapper}>
            <div className={`grid grid--fit grid--gap-1 ${styles['token']}`} style={{ '--data-width': `60px` }}>
              {token && (
                <>
                  <button
                    className="btn"
                    onClick={() => {
                      setToken('')
                    }}
                  >
                    Back
                  </button>
                  {token.map((item, i) => {
                    return (
                      <figure>
                        <img src={item.images[0].src} onClick={() => addToCanvas(item.images[0].src)} />
                      </figure>
                    )
                  })}
                </>
              )}
            </div>

            {!collection && (
              <div className={`grid grid--fit grid--gap-1`} style={{ '--data-width': `150px` }}>
                <div className="shimmer" style={{ width: `100%`, height: `80px` }} />
                <div className="shimmer" style={{ width: `100%`, height: `80px` }} />
                <div className="shimmer" style={{ width: `100%`, height: `80px` }} />
                <div className="shimmer" style={{ width: `100%`, height: `80px` }} />
                <div className="shimmer" style={{ width: `100%`, height: `80px` }} />
                <div className="shimmer" style={{ width: `100%`, height: `80px` }} />
                <div className="shimmer" style={{ width: `100%`, height: `80px` }} />
              </div>
            )}

            {!token &&
              collection &&
              collection.data.search_profiles[0].lsp5ReceivedAssets.map((item, i) => {
                return (
                  <div key={i} className={`card ${styles['card']}`} onClick={() => showTokens(item.asset.id)}>
                    <div className={`card__body ${styles['card__body']} d-f-c`} style={{ '--bg': `url('${item.asset.images[0]?.src}')` }}>
                      <small className={`text-center`}>
                        <b className={`text-nowrap text-truncate`}>{item.asset.lsp4TokenName}</b>
                      </small>
                    </div>
                  </div>
                )
              })}
          </div>
        </aside>

        <main className={`${styles.main} d-f-c`}>
          <canvas ref={canvasRef} id={`canvas`} width="760" height="570" className={`ms-depth-16`}></canvas>
        </main>

        <footer className={`${styles.footer} d-flex align-items-center justify-content-between ms-depth-8`}>
          <figure className={`d-f-c grid--gap-050`}>
            <img alt={``} src={Logo} />
            <figcaption>
              <b>FrameIt</b>
            </figcaption>
          </figure>
          <ul className={`d-flex align-items-center justify-content-between`}>
            <li>
              <button className={`${styles['collection']}`} disabled={!auth.walletConnected} onClick={(e) => showAside(e)}>
                My collections
              </button>
            </li>
            <li>
              <input ref={fileRef} type="file" accept="image/png, image/jpeg, image/gif" />
              <button className={`${styles['file']}`} onClick={(e) => chooseLocalFile(e)}>
                Choose file
              </button>
            </li>
            <li>
              <button className={`${styles['download']}`} onClick={() => downloadCanvas()}>
                Download
              </button>
            </li>
          </ul>
        </footer>
      </div>
    </>
  )
}

export default Home
