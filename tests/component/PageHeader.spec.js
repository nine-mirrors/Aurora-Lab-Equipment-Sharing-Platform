import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PageHeader from '@/components/common/PageHeader.vue'

describe('PageHeader', () => {
  it('渲染标题、描述与眉标', () => {
    const wrapper = mount(PageHeader, {
      props: {
        eyebrow: 'MY APPLICATIONS',
        title: '我的申请',
        description: '查看借用进度与审核结果'
      }
    })
    expect(wrapper.text()).toContain('MY APPLICATIONS')
    expect(wrapper.find('h1').text()).toBe('我的申请')
    expect(wrapper.text()).toContain('查看借用进度与审核结果')
  })

  it('没有 actions 插槽时不渲染操作区', () => {
    const wrapper = mount(PageHeader, { props: { title: '设备大厅' } })
    expect(wrapper.find('.heading-actions').exists()).toBe(false)
  })

  it('提供 actions 插槽时渲染操作区', () => {
    const wrapper = mount(PageHeader, {
      props: { title: '设备大厅' },
      slots: { actions: '<button class="test-action">筛选</button>' }
    })
    expect(wrapper.find('.heading-actions').exists()).toBe(true)
    expect(wrapper.find('.test-action').text()).toBe('筛选')
  })
})
