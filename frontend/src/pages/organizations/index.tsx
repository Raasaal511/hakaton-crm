import { useEffect } from 'react'
import { OrganizationList } from 'widgets/organization-list'
import { organizationsAPI } from 'shared/api/requests/organizations'
import { setOrganizations } from 'shared/api/events/organization'

export function OrganizationsPage() {
  useEffect(() => {
    organizationsAPI.getAll().then((orgs) => {
      setOrganizations(orgs)
    })
  }, [])

  return <OrganizationList />
}
