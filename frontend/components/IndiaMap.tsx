'use client'
import { useEffect, useState } from 'react'
import { StateImpact } from '@/lib/types'

export default function IndiaMap({ states }: { states: StateImpact[] }) {
  const [MapComponent, setMapComponent] = useState<any>(null)

  useEffect(() => {
    // Dynamically import Leaflet only on client side
    const loadMap = async () => {
      const L = (await import('leaflet')).default
      const { MapContainer, TileLayer, GeoJSON, Tooltip } = await import('react-leaflet')
      await import('leaflet/dist/leaflet.css')

      const geoData = await fetch('/india.geojson').then(r => r.json())

      const getColor = (score: number) => {
        if (score > 70) return '#de4540'
        if (score > 40) return '#ee9993'
        if (score > 20) return '#f6c2be'
        return '#e2dfdc'
      }

      const getScore = (stateName: string) => {
        const match = states.find(s =>
          stateName.toLowerCase().includes(s.state.toLowerCase()) ||
          s.state.toLowerCase().includes(stateName.toLowerCase())
        )
        return match ? match.impact_score : 0
      }

      const style = (feature: any) => {
        const score = getScore(feature.properties.NAME_1 || feature.properties.name || '')
        return {
          fillColor: getColor(score),
          fillOpacity: 0.75,
          color: '#ffffff',
          weight: 1,
        }
      }

      const onEachFeature = (feature: any, layer: any) => {
        const name = feature.properties.NAME_1 || feature.properties.name || ''
        const score = getScore(name)
        layer.bindTooltip(
          `<div style="background:#ffffff;color:#2e2928;padding:8px 12px;border-radius:10px;font-size:13px;border:1px solid #e2dfdc;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
            <strong style="color:#2e2928;">${name}</strong><br/>Impact Score: <span style="font-weight:bold;color:#de4540;">${score}/100</span>
          </div>`,
          { sticky: true, opacity: 1 }
        )
      }

      const Map = () => (
        <MapContainer
          center={[20.5937, 78.9629]}
          zoom={4}
          style={{ height: '450px', width: '100%', background: '#ecebe9' }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <GeoJSON
            key={JSON.stringify(states)}
            data={geoData}
            style={style}
            onEachFeature={onEachFeature}
          />
        </MapContainer>
      )

      setMapComponent(<Map />)
    }

    loadMap()
  }, [states])

  return (
    <div className="card p-7">
      <div className="flex items-center gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">State-wise Impact Map</h2>
          <p className="text-slate-500 text-xs">Hover over states to see impact scores</p>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-4 text-xs text-slate-600 font-medium">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-500 inline-block" />High (70-100)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-300 inline-block" />Medium (40-70)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-brand-200 inline-block" />Low (20-40)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" />Minimal (0-20)</span>
      </div>

      <div className="rounded-[20px] overflow-hidden border border-black/5">
        {MapComponent ? MapComponent : (
          <div className="h-[450px] bg-slate-100 rounded-xl flex items-center justify-center">
            <p className="text-slate-400">Loading map...</p>
          </div>
        )}
      </div>
    </div>
  )
}