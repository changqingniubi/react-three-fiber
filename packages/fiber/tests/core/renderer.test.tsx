import * as React from 'react'
import * as THREE from 'three'
import { createCanvas } from '@react-three/test-renderer/src/createTestCanvas'
import { createWebGLContext } from '@react-three/test-renderer/src/createWebGLContext'

import {
  ReconcilerRoot,
  createRoot,
  act,
  useFrame,
  extend,
  ReactThreeFiber,
  useThree,
  createPortal,
} from '../../src/index'
import { UseBoundStore } from 'zustand'
import { privateKeys, RootState } from '../../src/core/store'
import { Instance } from '../../src/core/renderer'

type ComponentMesh = THREE.Mesh<THREE.BoxBufferGeometry, THREE.MeshBasicMaterial>

interface ObjectWithBackground extends THREE.Object3D {
  background: THREE.Color
}

/* This class is used for one of the tests */
class HasObject3dMember extends THREE.Object3D {
  public attachment?: THREE.Object3D = undefined
}

/* This class is used for one of the tests */
class HasObject3dMethods extends THREE.Object3D {
  attachedObj3d?: THREE.Object3D
  detachedObj3d?: THREE.Object3D

  customAttach(obj3d: THREE.Object3D) {
    this.attachedObj3d = obj3d
  }

  detach(obj3d: THREE.Object3D) {
    this.detachedObj3d = obj3d
  }
}

class MyColor extends THREE.Color {
  constructor(col: number) {
    super(col)
  }
}

extend({ HasObject3dMember, HasObject3dMethods })

declare module '@react-three/fiber' {
  interface ThreeElements {
    hasObject3dMember: ReactThreeFiber.Node<HasObject3dMember, typeof HasObject3dMember>
    hasObject3dMethods: ReactThreeFiber.Node<HasObject3dMethods, typeof HasObject3dMethods>
    myColor: ReactThreeFiber.Node<MyColor, typeof MyColor>
  }
}

beforeAll(() => {
  Object.defineProperty(window, 'devicePixelRatio', {
    configurable: true,
    value: 2,
  })
})

describe('renderer', () => {
  let root: ReconcilerRoot<HTMLCanvasElement> = null!

  beforeEach(() => {
    const canvas = createCanvas({
      beforeReturn: (canvas) => {
        function getContext(
          contextId: '2d',
          options?: CanvasRenderingContext2DSettings,
        ): CanvasRenderingContext2D | null
        function getContext(
          contextId: 'bitmaprenderer',
          options?: ImageBitmapRenderingContextSettings,
        ): ImageBitmapRenderingContext | null
        function getContext(contextId: 'webgl', options?: WebGLContextAttributes): WebGLRenderingContext | null
        function getContext(contextId: 'webgl2', options?: WebGLContextAttributes): WebGL2RenderingContext | null
        function getContext(contextId: string): RenderingContext | null {
          if (contextId === 'webgl' || contextId === 'webgl2') {
            return createWebGLContext(canvas)
          }
          return null
        }

        canvas.getContext = getContext
      },
    })
    root = createRoot(canvas)
  })

  afterEach(() => {
    root.unmount()
  })

  it('renders a simple component', async () => {
    const Mesh = () => {
      return (
        <mesh>
          <boxGeometry args={[2, 2]} />
          <meshBasicMaterial />
        </mesh>
      )
    }
    let scene: THREE.Scene = null!
    await act(async () => {
      scene = root.render(<Mesh />).getState().scene
    })

    expect(scene.children[0].type).toEqual('Mesh')
    expect((scene.children[0] as ComponentMesh).geometry.type).toEqual('BoxGeometry')
    expect((scene.children[0] as ComponentMesh).material.type).toEqual('MeshBasicMaterial')
    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.type).toEqual(
      'MeshBasicMaterial',
    )
  })

  it('renders an empty scene', async () => {
    const Empty = () => null
    let scene: THREE.Scene = null!
    await act(async () => {
      scene = root.render(<Empty />).getState().scene
    })

    expect(scene.type).toEqual('Scene')
    expect(scene.children).toEqual([])
  })

  it('can render a composite component', async () => {
    class Parent extends React.Component {
      render() {
        return (
          <group>
            <color attach="background" args={[0, 0, 0]} />
            <Child />
          </group>
        )
      }
    }

    const Child = () => {
      return (
        <mesh>
          <boxGeometry args={[2, 2]} />
          <meshBasicMaterial />
        </mesh>
      )
    }

    let scene: THREE.Scene = null!
    await act(async () => {
      scene = root.render(<Parent />).getState().scene
    })

    expect(scene.children[0].type).toEqual('Group')
    expect((scene.children[0] as ObjectWithBackground).background.getStyle()).toEqual('rgb(0,0,0)')
    expect(scene.children[0].children[0].type).toEqual('Mesh')
    expect((scene.children[0].children[0] as ComponentMesh).geometry.type).toEqual('BoxGeometry')
    expect((scene.children[0].children[0] as ComponentMesh).material.type).toEqual('MeshBasicMaterial')
    expect(
      (scene.children[0].children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.type,
    ).toEqual('MeshBasicMaterial')
  })

  it('renders some basics with an update', async () => {
    let renders = 0

    class Component extends React.PureComponent {
      state = { pos: 3 }

      componentDidMount() {
        this.setState({ pos: 7 })
      }

      render() {
        renders++
        return (
          <group position-x={this.state.pos}>
            <Child />
            <Null />
          </group>
        )
      }
    }

    const Child = () => {
      renders++
      return <color attach="background" args={[0, 0, 0]} />
    }

    const Null = () => {
      renders++
      return null
    }

    let scene: THREE.Scene = null!
    await act(async () => {
      scene = root.render(<Component />).getState().scene
    })

    expect(scene.children[0].position.x).toEqual(7)
    expect(renders).toBe(6)
  })

  it('updates types & names', async () => {
    let scene: THREE.Scene = null!
    await act(async () => {
      scene = root
        .render(
          <mesh>
            <meshBasicMaterial name="basicMat">
              <color attach="color" args={[0, 0, 0]} />
            </meshBasicMaterial>
          </mesh>,
        )
        .getState().scene
    })

    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.type).toEqual(
      'MeshBasicMaterial',
    )
    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshBasicMaterial>).material.name).toEqual(
      'basicMat',
    )

    await act(async () => {
      scene = root
        .render(
          <mesh>
            <meshStandardMaterial name="standardMat">
              <color attach="color" args={[255, 255, 255]} />
            </meshStandardMaterial>
          </mesh>,
        )
        .getState().scene
    })

    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.type).toEqual(
      'MeshStandardMaterial',
    )
    expect((scene.children[0] as THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>).material.name).toEqual(
      'standardMat',
    )
  })

  it('should forward ref three object', async () => {
    // Note: Passing directly should be less strict, and assigning current should be more strict
    let immutableRef!: React.RefObject<THREE.Mesh>
    let mutableRef!: React.MutableRefObject<THREE.Mesh | null>
    let mutableRefSpecific!: React.MutableRefObject<THREE.Mesh | null>

    const RefTest = () => {
      immutableRef = React.createRef()
      mutableRef = React.useRef(null)
      mutableRefSpecific = React.useRef(null)

      return (
        <>
          <mesh ref={immutableRef} />
          <mesh ref={mutableRef} />
          <mesh ref={(r) => (mutableRefSpecific.current = r)} />
        </>
      )
    }

    await act(async () => {
      root.render(<RefTest />)
    })

    expect(immutableRef.current).toBeTruthy()
    expect(mutableRef.current).toBeTruthy()
    expect(mutableRefSpecific.current).toBeTruthy()
  })

  it('attaches Object3D children that use attach', async () => {
    let scene: THREE.Scene = null!
    await act(async () => {
      scene = root
        .render(
          <hasObject3dMember>
            <mesh attach="attachment" />
          </hasObject3dMember>,
        )
        .getState().scene
    })

    const attachedMesh = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedMesh).toBeDefined()
    expect(attachedMesh?.type).toBe('Mesh')
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  it('can attach a Scene', async () => {
    let scene: THREE.Scene = null!
    await act(async () => {
      scene = root
        .render(
          <hasObject3dMember>
            <scene attach="attachment" />
          </hasObject3dMember>,
        )
        .getState().scene
    })

    const attachedScene = (scene.children[0] as HasObject3dMember).attachment
    expect(attachedScene).toBeDefined()
    expect(attachedScene?.type).toBe('Scene')
    // attaching is *instead of* being a regular child
    expect(scene.children[0].children.length).toBe(0)
  })

  describe('attaches Object3D children that use attachFns', () => {
    it('attachFns with cleanup', async () => {
      let scene: THREE.Scene = null!
      await act(async () => {
        scene = root
          .render(
            <hasObject3dMethods>
              <mesh attach={(parent, self) => (parent.customAttach(self), () => parent.detach(self))} />
            </hasObject3dMethods>,
          )
          .getState().scene
      })

      const attachedMesh = (scene.children[0] as HasObject3dMethods).attachedObj3d
      expect(attachedMesh).toBeDefined()
      expect(attachedMesh?.type).toBe('Mesh')
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      // and now detach ..
      expect((scene.children[0] as HasObject3dMethods).detachedObj3d).toBeUndefined()

      await act(async () => {
        root.render(<hasObject3dMethods />)
      })

      const detachedMesh = (scene.children[0] as HasObject3dMethods).detachedObj3d
      expect(detachedMesh).toBe(attachedMesh)
    })

    it('attachFns as functions', async () => {
      let scene: THREE.Scene = null!
      let attachedMesh: Instance = null!
      let detachedMesh: Instance = null!

      await act(async () => {
        scene = root
          .render(
            <hasObject3dMethods>
              <mesh attach={(parent) => ((attachedMesh = parent), () => (detachedMesh = parent))} />
            </hasObject3dMethods>,
          )
          .getState().scene
      })

      expect(attachedMesh).toBeDefined()
      expect(attachedMesh?.type).toBe('Object3D')
      // attaching is *instead of* being a regular child
      expect(scene.children[0].children.length).toBe(0)

      await act(async () => {
        root.render(<hasObject3dMethods />)
      })

      expect(detachedMesh).toBe(attachedMesh)
    })
  })

  it('does the full lifecycle', async () => {
    const log: string[] = []
    class Log extends React.Component<{ name: string }> {
      render() {
        log.push('render ' + this.props.name)
        return <group />
      }
      componentDidMount() {
        log.push('mount ' + this.props.name)
      }
      componentWillUnmount() {
        log.push('unmount ' + this.props.name)
      }
    }

    await act(async () => {
      root.render(<Log key="foo" name="Foo" />)
    })

    await act(async () => {
      root.unmount()
    })

    expect(log).toEqual(['render Foo', 'mount Foo', 'unmount Foo'])
  })

  it('will mount/unmount event handlers correctly', async () => {
    let state: RootState = null!
    let mounted = false
    let attachEvents = false

    const EventfulComponent = () => (mounted ? <group onClick={attachEvents ? () => void 0 : undefined} /> : null)

    // Test initial mount without events
    mounted = true
    await act(async () => {
      state = root.render(<EventfulComponent />).getState()
    })
    expect(state.internal.interaction.length).toBe(0)

    // Test initial mount with events
    attachEvents = true
    await act(async () => {
      state = root.render(<EventfulComponent />).getState()
    })
    expect(state.internal.interaction.length).not.toBe(0)

    // Test events update
    attachEvents = false
    await act(async () => {
      state = root.render(<EventfulComponent />).getState()
    })
    expect(state.internal.interaction.length).toBe(0)

    attachEvents = true
    await act(async () => {
      state = root.render(<EventfulComponent />).getState()
    })
    expect(state.internal.interaction.length).not.toBe(0)

    // Test unmount with events
    mounted = false
    await act(async () => {
      state = root.render(<EventfulComponent />).getState()
    })
    expect(state.internal.interaction.length).toBe(0)
  })

  it('will create an identical instance when reconstructing', async () => {
    let state: RootState = null!
    const instances: { uuid: string; parentUUID?: string; childUUID?: string }[] = []

    const object1 = new THREE.Group()
    const object2 = new THREE.Group()

    const Test = ({ first }: { first?: boolean }) => (
      <primitive object={first ? object1 : object2} onPointerOver={() => null}>
        <group />
      </primitive>
    )

    await act(async () => {
      state = root.render(<Test first />).getState()
    })

    instances.push({
      uuid: state.scene.children[0].uuid,
      parentUUID: state.scene.children[0].parent?.uuid,
      childUUID: state.scene.children[0].children[0]?.uuid,
    })
    expect(state.scene.children[0]).toBe(object1)

    await act(async () => {
      state = root.render(<Test />).getState()
    })

    instances.push({
      uuid: state.scene.children[0].uuid,
      parentUUID: state.scene.children[0].parent?.uuid,
      childUUID: state.scene.children[0].children[0]?.uuid,
    })

    const [oldInstance, newInstance] = instances

    // Swapped to new instance
    expect(state.scene.children[0]).toBe(object2)

    // Preserves scene hierarchy
    expect(oldInstance.parentUUID).toBe(newInstance.parentUUID)
    expect(oldInstance.childUUID).toBe(newInstance.childUUID)

    // Rebinds events
    expect(state.internal.interaction.length).not.toBe(0)
  })

  it('can swap primitives', async () => {
    let state: RootState = null!

    const o1 = new THREE.Group()
    o1.add(new THREE.Group())
    const o2 = new THREE.Group()

    const Test = ({ n }: { n: number }) => (
      <primitive object={n === 1 ? o1 : o2}>
        <group attach="test" />
      </primitive>
    )

    await act(async () => {
      state = root.render(<Test n={1} />).getState()
    })

    // Initial object is added with children and attachments
    expect(state.scene.children[0]).toBe(o1)
    expect(state.scene.children[0].children.length).toBe(1)
    expect((state.scene.children[0] as any).test).toBeInstanceOf(THREE.Group)

    await act(async () => {
      state = root.render(<Test n={2} />).getState()
    })

    // Swapped to object 2, does not copy old children, copies attachments
    expect(state.scene.children[0]).toBe(o2)
    expect(state.scene.children[0].children.length).toBe(0)
    expect((state.scene.children[0] as any).test).toBeInstanceOf(THREE.Group)
  })

  it('will make an Orthographic Camera & set the position', async () => {
    let camera: THREE.Camera = null!

    await act(async () => {
      camera = root
        .configure({ orthographic: true, camera: { position: [0, 0, 5] } })
        .render(<group />)
        .getState().camera
    })

    expect(camera.type).toEqual('OrthographicCamera')
    expect(camera.position.z).toEqual(5)
  })

  it('should handle an performance changing functions', async () => {
    let state: UseBoundStore<RootState> = null!
    await act(async () => {
      state = root.configure({ dpr: [1, 2], performance: { min: 0.2 } }).render(<group />)
    })

    expect(state.getState().viewport.initialDpr).toEqual(2)
    expect(state.getState().performance.min).toEqual(0.2)
    expect(state.getState().performance.current).toEqual(1)

    await act(async () => {
      state.getState().setDpr(0.1)
    })

    expect(state.getState().viewport.dpr).toEqual(0.1)

    jest.useFakeTimers()

    await act(async () => {
      state.getState().performance.regress()
      jest.advanceTimersByTime(100)
    })

    expect(state.getState().performance.current).toEqual(0.2)

    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    expect(state.getState().performance.current).toEqual(1)

    jest.useRealTimers()
  })

  it('should set PCFSoftShadowMap as the default shadow map', async () => {
    let state: UseBoundStore<RootState> = null!
    await act(async () => {
      state = root.configure({ shadows: true }).render(<group />)
    })

    expect(state.getState().gl.shadowMap.type).toBe(THREE.PCFSoftShadowMap)
  })

  it('should set tonemapping to ACESFilmicToneMapping and outputEncoding to sRGBEncoding if linear is false', async () => {
    let state: UseBoundStore<RootState> = null!
    await act(async () => {
      state = root.configure({ linear: false }).render(<group />)
    })

    expect(state.getState().gl.toneMapping).toBe(THREE.ACESFilmicToneMapping)
    expect(state.getState().gl.outputEncoding).toBe(THREE.sRGBEncoding)
  })

  it('should toggle render mode in xr', async () => {
    let state: RootState = null!

    await act(async () => {
      state = root.render(<group />).getState()
      state.gl.xr.isPresenting = true
      state.gl.xr.dispatchEvent({ type: 'sessionstart' })
    })

    expect(state.gl.xr.enabled).toEqual(true)

    await act(async () => {
      state.gl.xr.isPresenting = false
      state.gl.xr.dispatchEvent({ type: 'sessionend' })
    })

    expect(state.gl.xr.enabled).toEqual(false)
  })

  it('should respect frameloop="never" in xr', async () => {
    let respected = true

    await act(async () => {
      const TestGroup = () => {
        useFrame(() => (respected = false))
        return <group />
      }
      const state = root
        .configure({ frameloop: 'never' })
        .render(<TestGroup />)
        .getState()
      state.gl.xr.isPresenting = true
      state.gl.xr.dispatchEvent({ type: 'sessionstart' })
    })

    expect(respected).toEqual(true)
  })

  it('will render components that are extended', async () => {
    const testExtend = async () => {
      await act(async () => {
        extend({ MyColor })

        root.render(<myColor args={[0x0000ff]} />)
      })
    }

    expect(() => testExtend()).not.toThrow()
  })

  it('should set renderer props via gl prop', async () => {
    let gl: THREE.WebGLRenderer = null!
    await act(async () => {
      gl = root
        .configure({ gl: { physicallyCorrectLights: true } })
        .render(<group />)
        .getState().gl
    })

    expect(gl.physicallyCorrectLights).toBe(true)
  })

  it('should set a renderer via gl callback', async () => {
    class Renderer extends THREE.WebGLRenderer {}

    let gl: Renderer = null!
    await act(async () => {
      gl = root
        .configure({ gl: (canvas) => new Renderer({ canvas }) })
        .render(<group />)
        .getState().gl
    })

    expect(gl instanceof Renderer).toBe(true)
  })

  it('should respect color management preferences via gl', async () => {
    let gl: THREE.WebGLRenderer = null!
    await act(async () => {
      gl = root
        .configure({ gl: { outputEncoding: THREE.LinearEncoding, toneMapping: THREE.NoToneMapping } })
        .render(<group />)
        .getState().gl
    })

    expect(gl.outputEncoding).toBe(THREE.LinearEncoding)
    expect(gl.toneMapping).toBe(THREE.NoToneMapping)

    await act(async () => {
      gl = root
        .configure({ flat: true, linear: true })
        .render(<group />)
        .getState().gl
    })
    expect(gl.outputEncoding).toBe(THREE.LinearEncoding)
    expect(gl.toneMapping).toBe(THREE.NoToneMapping)
  })

  it('should respect legacy prop', async () => {
    await act(async () => {
      root.configure({ legacy: true }).render(<group />)
    })
    expect((THREE as any).ColorManagement.legacyMode).toBe(true)

    await act(async () => {
      root.configure({ legacy: false }).render(<group />)
    })
    expect((THREE as any).ColorManagement.legacyMode).toBe(false)
  })

  it('can handle createPortal', async () => {
    const scene = new THREE.Scene()

    let state: RootState = null!
    let portalState: RootState = null!

    const Normal = () => {
      const three = useThree()
      state = three

      return <group />
    }

    const Portal = () => {
      const three = useThree()
      portalState = three

      return <group />
    }

    await act(async () => {
      root.render(
        <>
          <Normal />
          {createPortal(<Portal />, scene, { scene })}
        </>,
      )
    })

    // Renders into portal target
    expect(scene.children.length).not.toBe(0)

    // Creates an isolated state enclave
    expect(state.scene).not.toBe(scene)
    expect(portalState.scene).toBe(scene)

    // Preserves internal keys
    const overwrittenKeys = ['get', 'set', 'events', 'size', 'viewport']
    const respectedKeys = privateKeys.filter((key) => overwrittenKeys.includes(key) || state[key] === portalState[key])
    expect(respectedKeys).toStrictEqual(privateKeys)
  })

  it('can handle createPortal on unmounted container', async () => {
    let groupHandle!: THREE.Group | null
    function Test(props: any) {
      const [group, setGroup] = React.useState(null)
      groupHandle = group

      return (
        <group {...props} ref={setGroup}>
          {group && createPortal(<mesh />, group)}
        </group>
      )
    }

    await act(async () => root.render(<Test key={0} />))

    expect(groupHandle).toBeDefined()
    const prevUUID = groupHandle!.uuid

    await act(async () => root.render(<Test key={1} />))

    expect(groupHandle).toBeDefined()
    expect(prevUUID).not.toBe(groupHandle!.uuid)
  })

  it('invalidates pierced props when root is changed', async () => {
    const material = React.createRef<THREE.MeshBasicMaterial>()
    const texture1 = { needsUpdate: false, name: '' } as THREE.Texture
    const texture2 = { needsUpdate: false, name: '' } as THREE.Texture

    await act(async () =>
      root.render(<meshBasicMaterial ref={material} map={texture1} map-needsUpdate={true} map-name="test" />),
    )

    expect(material.current!.map).toBe(texture1)
    expect(texture1.needsUpdate).toBe(true)
    expect(texture1.name).toBe('test')

    await act(async () =>
      root.render(<meshBasicMaterial ref={material} map={texture2} map-needsUpdate={true} map-name="test" />),
    )

    expect(material.current!.map).toBe(texture2)
    expect(texture2.needsUpdate).toBe(true)
    expect(texture2.name).toBe('test')
  })
})
