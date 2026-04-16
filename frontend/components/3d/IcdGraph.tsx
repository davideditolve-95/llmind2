'use client';

import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  Suspense,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { icd11Api, type IcdNode } from '@/lib/api';

// ─── Colori per livello gerarchico ─────────────────────────────────────────
const LEVEL_COLORS = [
  '#87A878', // Livello 0 — capitoli (sage green)
  '#B4D4E7', // Livello 1 — sezioni (powder blue)
  '#C9B8D4', // Livello 2 — categorie (lavender)
  '#D4C5B0', // Livello 3+ — sottocategorie (warm)
];

// Dimensione delle sfere per livello
const LEVEL_SIZES = [1.4, 0.9, 0.55, 0.35];

// ─── Tipi interni ──────────────────────────────────────────────────────────
interface GraphNode {
  id: string;
  label: string;
  code: string | null;
  level: number;
  has_children: boolean;
  parent_id: string | null;
  x: number;
  y: number;
  z: number;
  color: string;
}

interface GraphEdge {
  sourceId: string;
  targetId: string;
  source: GraphNode;
  target: GraphNode;
}

// ─── Componente: singolo nodo 3D ──────────────────────────────────────────
function NodeMesh({
  node,
  isSelected,
  onClick,
}: {
  node: GraphNode;
  isSelected: boolean;
  onClick: (node: GraphNode) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const size = LEVEL_SIZES[Math.min(node.level, LEVEL_SIZES.length - 1)];

  // Animazione di rotazione sui nodi selezionati o in hover
  useFrame(({ clock }) => {
    if (meshRef.current && (isSelected || hovered)) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.5;
    }
    // Pulsazione lieve sul livello 0
    if (meshRef.current && node.level === 0) {
      const pulse = 1 + Math.sin(clock.getElapsedTime() * 1.5) * 0.04;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[node.x, node.y, node.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(node);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[size, 24, 24]} />
        <meshStandardMaterial
          color={node.color}
          emissive={isSelected ? node.color : hovered ? node.color : '#000000'}
          emissiveIntensity={isSelected ? 0.5 : hovered ? 0.3 : 0}
          roughness={0.4}
          metalness={0.1}
          transparent
          opacity={hovered || isSelected ? 1.0 : 0.88}
        />
      </mesh>

      {/* Anello di selezione */}
      {isSelected && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size + 0.15, size + 0.3, 32]} />
          <meshBasicMaterial color={node.color} transparent opacity={0.6} />
        </mesh>
      )}

      {/* Label HTML sovrapposta — visibile per capitoli o nodi selezionati/hovered */}
      {(node.level === 0 || isSelected || hovered) && (
        <Html center distanceFactor={12} zIndexRange={[100, 0]}>
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.88)',
              color: '#e2e8f0',
              padding: '5px 10px',
              borderRadius: '10px',
              fontSize: node.level === 0 ? '11px' : '9px',
              fontWeight: node.level === 0 ? 600 : 400,
              whiteSpace: 'nowrap',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${node.color}44`,
              pointerEvents: 'none',
              userSelect: 'none',
              fontFamily: 'Inter, sans-serif',
              lineHeight: 1.3,
            }}
          >
            {node.code && (
              <span
                style={{
                  color: node.color,
                  fontSize: '8px',
                  fontWeight: 700,
                  marginRight: '4px',
                  letterSpacing: '0.5px',
                }}
              >
                {node.code}
              </span>
            )}
            {node.label.length > 35 ? node.label.substring(0, 35) + '…' : node.label}
          </div>
        </Html>
      )}
    </group>
  );
}

// ─── Componente: spigolo tra nodi ─────────────────────────────────────────
function EdgeLine({ edge }: { edge: GraphEdge }) {
  const positions = useMemo(
    () =>
      new Float32Array([
        edge.source.x, edge.source.y, edge.source.z,
        edge.target.x, edge.target.y, edge.target.z,
      ]),
    [edge]
  );

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={2}
          args={[positions, 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial
        color="#94a3b8"
        opacity={edge.source.level === 0 ? 0.4 : 0.2}
        transparent
      />
    </line>
  );
}

// ─── Controller dell'animazione camera ───────────────────────────────────
function CameraAnimator({ target }: { target: THREE.Vector3 | null }) {
  const { camera } = useThree();
  const animTarget = useRef<THREE.Vector3 | null>(null);

  useEffect(() => {
    if (target) {
      // Avvicina la camera al nodo selezionato (zoom in)
      const offset = target.clone().normalize().multiplyScalar(target.length() * 2.5 + 8);
      animTarget.current = offset;
    }
  }, [target]);

  useFrame(() => {
    if (animTarget.current) {
      camera.position.lerp(animTarget.current, 0.04);
      if (camera.position.distanceTo(animTarget.current) < 0.05) {
        animTarget.current = null;
      }
    }
  });

  return null;
}

// ─── Layout radiale per i nodi ────────────────────────────────────────────
/**
 * Posiziona i nodi dell'albero ICD-11 in un layout radiale gerarchico.
 * I capitoli sono disposti in cerchio, i loro figli attorno ad essi.
 */
function computeLayout(nodes: IcdNode[], parentNode?: GraphNode): GraphNode[] {
  const results: GraphNode[] = [];

  if (!parentNode) {
    // Layout circolare per i capitoli di primo livello
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const radius = 12;
      results.push({
        id: node.id,
        label: node.label,
        code: node.code,
        level: 0,
        has_children: node.has_children,
        parent_id: null,
        x: Math.cos(angle) * radius,
        y: (Math.random() - 0.5) * 3,
        z: Math.sin(angle) * radius,
        color: LEVEL_COLORS[0],
      });
    });
  } else {
    // Layout circolare attorno al nodo genitore
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      const radius = 5;
      results.push({
        id: node.id,
        label: node.label,
        code: node.code,
        level: node.level,
        has_children: node.has_children,
        parent_id: parentNode.id,
        x: parentNode.x + Math.cos(angle) * radius,
        y: parentNode.y + (Math.random() - 0.5) * 2,
        z: parentNode.z + Math.sin(angle) * radius,
        color: LEVEL_COLORS[Math.min(node.level, LEVEL_COLORS.length - 1)],
      });
    });
  }

  return results;
}

// ─── Scena 3D ────────────────────────────────────────────────────────────
function Scene({
  onNodeSelect,
}: {
  onNodeSelect: (node: GraphNode, path: GraphNode[]) => void;
}) {
  const [allNodes, setAllNodes] = useState<GraphNode[]>([]);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [cameraTarget, setCameraTarget] = useState<THREE.Vector3 | null>(null);
  const [navigationPath, setNavigationPath] = useState<GraphNode[]>([]);
  const nodeMapRef = useRef<Map<string, GraphNode>>(new Map());

  // Carica i capitoli ICD-11 al mount
  useEffect(() => {
    icd11Api
      .getTree(2)
      .then((tree) => {
        // Processa capitoli (livello 0)
        const topLevelNodes = computeLayout(tree);
        const nodeMap = new Map<string, GraphNode>();
        const edges: GraphEdge[] = [];
        const allN = [...topLevelNodes];

        topLevelNodes.forEach((parentNode) => {
          nodeMap.set(parentNode.id, parentNode);

          // Processa figli (livello 1)
          const treeNode = tree.find((t) => t.id === parentNode.id);
          if (treeNode?.children?.length) {
            const childNodes = computeLayout(treeNode.children, parentNode);
            childNodes.forEach((childNode) => {
              nodeMap.set(childNode.id, childNode);
              allN.push(childNode);
              edges.push({ sourceId: parentNode.id, targetId: childNode.id, source: parentNode, target: childNode });
            });
          }
        });

        nodeMapRef.current = nodeMap;
        setAllNodes(allN);
        setAllEdges(edges);
      })
      .catch(console.error);
  }, []);

  const handleNodeClick = useCallback(
    async (node: GraphNode) => {
      setSelectedNode(node);
      setCameraTarget(new THREE.Vector3(node.x, node.y, node.z));

      // Aggiorna il percorso di navigazione
      const existingIndex = navigationPath.findIndex((n) => n.id === node.id);
      if (existingIndex >= 0) {
        setNavigationPath((prev) => prev.slice(0, existingIndex + 1));
      } else {
        setNavigationPath((prev) => [...prev, node]);
      }

      onNodeSelect(node, [...navigationPath, node]);

      // Carica i figli se non sono ancora stati caricati
      if (node.has_children) {
        const existingChildren = allNodes.filter((n) => n.parent_id === node.id);
        if (existingChildren.length === 0) {
          try {
            const children = await icd11Api.getChildren(node.id);
            if (children.length > 0) {
              const childNodes = computeLayout(children, node);
              const newEdges: GraphEdge[] = childNodes.map((child) => ({
                sourceId: node.id,
                targetId: child.id,
                source: node,
                target: child,
              }));

              childNodes.forEach((cn) => nodeMapRef.current.set(cn.id, cn));
              setAllNodes((prev) => [...prev, ...childNodes]);
              setAllEdges((prev) => [...prev, ...newEdges]);
            }
          } catch (err) {
            console.error('Errore caricamento figli nodo:', err);
          }
        }
      }
    },
    [allNodes, navigationPath, onNodeSelect]
  );

  return (
    <>
      {/* Luci della scena */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[15, 15, 10]} intensity={0.8} color="#f8f9fa" />
      <pointLight position={[-10, 8, -10]} intensity={0.4} color="#B4D4E7" />
      <pointLight position={[10, -5, 10]} intensity={0.3} color="#87A878" />

      {/* Controlli orbitali */}
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        minDistance={3}
        maxDistance={60}
        autoRotate={allNodes.length > 0 && !selectedNode}
        autoRotateSpeed={0.3}
      />

      {/* Animatore camera */}
      <CameraAnimator target={cameraTarget} />

      {/* Spigoli */}
      {allEdges.map((edge, i) => (
        <EdgeLine key={`${edge.sourceId}-${edge.targetId}-${i}`} edge={edge} />
      ))}

      {/* Nodi */}
      {allNodes.map((node) => (
        <NodeMesh
          key={node.id}
          node={node}
          isSelected={selectedNode?.id === node.id}
          onClick={handleNodeClick}
        />
      ))}
    </>
  );
}

// ─── Componente principale esportato ─────────────────────────────────────
export default function IcdGraph({
  onNodeSelect,
}: {
  onNodeSelect: (node: { id: string; label: string; code?: string | null }, path: { id: string; label: string }[]) => void;
}) {
  return (
    <Canvas
      camera={{ position: [0, 8, 28], fov: 55 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#0f172a']} />
      <fog attach="fog" args={['#0f172a', 40, 80]} />
      <Scene onNodeSelect={onNodeSelect as Parameters<typeof Scene>[0]['onNodeSelect']} />
    </Canvas>
  );
}
